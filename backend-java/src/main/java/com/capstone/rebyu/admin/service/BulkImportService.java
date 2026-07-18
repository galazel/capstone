package com.capstone.rebyu.admin.service;

import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.BufferedReader;
import java.io.StringReader;
import java.util.*;

@Service
public class BulkImportService {

  @Autowired private LearnerRepository learnerRepository;

  public record ImportResult(Long id, String status, int totalRows, int successCount, int errorCount, List<String> errors) {}

  @Transactional
  public ImportResult importLearnersFromCSV(String csvContent, Long orgId) {
    long importId = System.currentTimeMillis();
    List<String> errors = new ArrayList<>();
    int successCount = 0;
    int errorCount = 0;

    try (BufferedReader reader = new BufferedReader(new StringReader(csvContent))) {
      String line;
      int rowNum = 0;
      String[] headers = null;

      while ((line = reader.readLine()) != null) {
        rowNum++;

        // Parse header
        if (rowNum == 1) {
          headers = line.split(",");
          continue;
        }

        try {
          String[] values = line.split(",");
          Map<String, String> row = new HashMap<>();
          for (int i = 0; i < headers.length; i++) {
            row.put(headers[i].trim(), i < values.length ? values[i].trim() : "");
          }

          // Validate required fields
          if (row.get("email").isEmpty() || row.get("firstName").isEmpty()) {
            errorCount++;
            errors.add("Row " + rowNum + ": Missing email or firstName");
            continue;
          }

          // Create learner
          Learner learner = new Learner();
          learner.setEmail(row.get("email"));
          learner.setFirstName(row.get("firstName"));
          learner.setLastName(row.getOrDefault("lastName", ""));
          learner.setIsActive(true);

          learnerRepository.save(learner);
          successCount++;
        } catch (Exception e) {
          errorCount++;
          errors.add("Row " + rowNum + ": " + e.getMessage());
        }
      }
    } catch (Exception e) {
      return new ImportResult(importId, "FAILED", rowNum, successCount, errorCount, List.of(e.getMessage()));
    }

    return new ImportResult(importId, "COMPLETED", rowNum, successCount, errorCount, errors);
  }
}
