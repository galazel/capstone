package com.capstone.rebyu.env;

import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvEntry;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "dotenv";

    private static final List<String> SEARCH_DIRECTORIES = List.of("./", "./backend-java", "../");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        for (String directory : SEARCH_DIRECTORIES) {
            Map<String, Object> values = read(directory);
            if (!values.isEmpty()) {
                environment.getPropertySources().addLast(new MapPropertySource(PROPERTY_SOURCE_NAME, values));
                return;
            }
        }
    }

    private Map<String, Object> read(String directory) {
        Dotenv dotenv = Dotenv.configure()
                .directory(directory)
                .filename(".env")
                .ignoreIfMalformed()
                .ignoreIfMissing()
                .load();

        Map<String, Object> values = new LinkedHashMap<>();
        for (DotenvEntry entry : dotenv.entries(Dotenv.Filter.DECLARED_IN_ENV_FILE)) {
            values.put(entry.getKey(), entry.getValue());
        }
        return values;
    }
}
