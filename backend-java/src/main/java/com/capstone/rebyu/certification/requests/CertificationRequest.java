package com.capstone.rebyu.certification.requests;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public record CertificationRequest(String title, String description, String industry, List<MultipartFile> files) {
}
