package com.capstone.rebyu.aigateway.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPicture;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Extracts embedded source images and places stable S3 markers beside source text. */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionSourceImageService {

    /** One image extracted from a source file, with enough context to link and caption it. */
    public record ExtractedImage(
            String key, String contentType, Integer page, Integer order, String nearbyText) {}

    /**
     * {@code images} carries the structured per-image metadata (page/order/
     * content type/nearby text) used to persist {@code KnowledgeDocumentImage}
     * rows; {@code imageKeys} is kept as a flat set for existing callers that
     * only need trusted-key validation.
     */
    public record ExtractedSource(String text, Set<String> imageKeys, List<ExtractedImage> images) {}

    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    public ExtractedSource extract(MultipartFile file, String fallbackText) throws IOException {
        String name = file.getOriginalFilename() == null ? "source" : file.getOriginalFilename();
        String lowerName = name.toLowerCase();
        try {
            if ("application/pdf".equals(file.getContentType()) || lowerName.endsWith(".pdf")) {
                return extractPdf(file.getBytes(), name);
            }
            if (lowerName.endsWith(".docx") ||
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            .equals(file.getContentType())) {
                return extractDocx(file.getBytes(), name);
            }
        } catch (Exception e) {
            log.warn("Embedded-image extraction failed for '{}'; continuing with text only: {}",
                    name, e.getMessage());
        }
        return new ExtractedSource(fallbackText, Set.of(), List.of());
    }

    /** Downloads and base64-encodes an already-extracted image for a vision-model prompt. */
    public String downloadAsBase64(String key) throws IOException {
        byte[] bytes = s3Client.getObject(GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .build())
                .readAllBytes();
        return Base64.getEncoder().encodeToString(bytes);
    }

    private ExtractedSource extractPdf(byte[] bytes, String filename) throws IOException {
        StringBuilder context = new StringBuilder();
        Set<String> keys = new LinkedHashSet<>();
        List<ExtractedImage> images = new ArrayList<>();
        try (PDDocument document = PDDocument.load(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            for (int pageIndex = 0; pageIndex < document.getNumberOfPages(); pageIndex++) {
                int pageNumber = pageIndex + 1;
                stripper.setStartPage(pageNumber);
                stripper.setEndPage(pageNumber);
                String pageText = stripper.getText(document).trim();
                context.append("\n--- SOURCE PAGE ").append(pageNumber).append(" ---\n")
                        .append(pageText).append('\n');
                PDPage page = document.getPage(pageIndex);
                List<PDImageXObject> pdImages = new ArrayList<>();
                collectPdfImages(page.getResources(), pdImages, new HashSet<>());
                for (int imageIndex = 0; imageIndex < pdImages.size(); imageIndex++) {
                    String key = uploadPng(pdImages.get(imageIndex), filename, pageNumber, imageIndex + 1);
                    keys.add(key);
                    images.add(new ExtractedImage(key, "image/png", pageNumber, imageIndex + 1,
                            nearbyText(pageText)));
                    context.append("[SOURCE_IMAGE key=\"").append(key)
                            .append("\" page=").append(pageNumber)
                            .append(" order=").append(imageIndex + 1).append("]\n");
                }
            }
        }
        return new ExtractedSource(context.toString(), Set.copyOf(keys), List.copyOf(images));
    }

    /** A short snippet of the surrounding text, used as a caption/context hint for the AI. */
    private String nearbyText(String pageText) {
        if (pageText == null || pageText.isBlank()) return null;
        String trimmed = pageText.trim();
        return trimmed.length() > 300 ? trimmed.substring(0, 300) : trimmed;
    }

    private void collectPdfImages(PDResources resources, List<PDImageXObject> images,
                                  Set<PDXObject> visited) throws IOException {
        if (resources == null) return;
        for (var name : resources.getXObjectNames()) {
            PDXObject object = resources.getXObject(name);
            if (object == null || !visited.add(object)) continue;
            if (object instanceof PDImageXObject image) {
                images.add(image);
            } else if (object instanceof PDFormXObject form) {
                collectPdfImages(form.getResources(), images, visited);
            }
        }
    }

    private ExtractedSource extractDocx(byte[] bytes, String filename) throws IOException {
        StringBuilder context = new StringBuilder();
        Set<String> keys = new LinkedHashSet<>();
        List<ExtractedImage> images = new ArrayList<>();
        int imageIndex = 0;
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            String precedingText = null;
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                if (text != null && !text.isBlank()) {
                    context.append(text.trim()).append('\n');
                    precedingText = text.trim();
                }
                for (XWPFRun run : paragraph.getRuns()) {
                    for (XWPFPicture picture : run.getEmbeddedPictures()) {
                        imageIndex++;
                        byte[] imageBytes = picture.getPictureData().getData();
                        String extension = picture.getPictureData().suggestFileExtension();
                        String contentType = picture.getPictureData().getPackagePart().getContentType();
                        String key = upload(imageBytes, extension, contentType, filename, 0, imageIndex);
                        keys.add(key);
                        images.add(new ExtractedImage(key, contentType, null, imageIndex, precedingText));
                        context.append("[SOURCE_IMAGE key=\"").append(key)
                                .append("\" order=").append(imageIndex).append("]\n");
                    }
                }
            }
        }
        return new ExtractedSource(context.toString(), Set.copyOf(keys), List.copyOf(images));
    }

    private String uploadPng(PDImageXObject image, String filename, int page, int order)
            throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image.getImage(), "png", output);
        return upload(output.toByteArray(), "png", "image/png", filename, page, order);
    }

    private String upload(byte[] bytes, String extension, String contentType,
                          String filename, int page, int order) {
        String safeExtension = extension == null || extension.isBlank() ? "png" : extension;
        String key = "question-source-images/" + UUID.randomUUID() + "-p" + page
                + "-" + order + "." + safeExtension;
        s3Client.putObject(PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(contentType == null ? "application/octet-stream" : contentType)
                        .metadata(java.util.Map.of("source-filename", filename))
                        .build(),
                RequestBody.fromBytes(bytes));
        return key;
    }
}
