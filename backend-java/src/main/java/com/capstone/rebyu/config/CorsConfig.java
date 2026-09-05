package com.capstone.rebyu.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    /**
     * Where the browser is allowed to be when it calls this API.
     *
     * A property rather than a literal list, because the list changed the day a
     * real domain was pointed at the frontend and the only way to add it was to
     * edit Java, rebuild and redeploy the API -- for a value that is deployment
     * configuration, not code. `app.cors.allowed-origins` overrides it as a
     * comma-separated list; the default below is what ships.
     *
     * Both rebyu.online hosts are listed. A browser sends the host it was given,
     * so www and the apex are two different origins to CORS even when they serve
     * the same site, and whichever one is missing is the one a learner will type.
     *
     * Credentials are allowed on these responses, so this stays an explicit
     * allowlist -- never a wildcard, which the spec forbids with credentials
     * anyway, and never a pattern loose enough to match a domain somebody else
     * can register.
     */
    @Value("${app.cors.allowed-origins:"
            + "https://www.rebyu.online,"
            + "https://rebyu.online,"
            + "https://rebyu.up.railway.app,"
            + "http://localhost:3000,"
            + "http://localhost:5173}")
    private List<String> allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(allowedOrigins);

        configuration.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        configuration.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin"
        ));

        configuration.setExposedHeaders(List.of(
                "Authorization"
        ));

        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
