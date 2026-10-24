package fr.openbook.api.controllers;

import fr.openbook.api.services.media.MediaServiceClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/images")
@RequiredArgsConstructor
public class ImageController {

    private final MediaServiceClient mediaServiceClient;

    /**
     * POST /images: Cree une "image virtuelle", l'api renvoie un uuid.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createVirtualImage() {
        String uuid = mediaServiceClient.createVirtualImage();
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", uuid, "status", "pending"));
    }

    /**
     * POST /images/{id}: Upload une image sur cet id (multipart/form-data).
     */
    @PostMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadImageMultipart(
            @PathVariable("id") String id,
            @RequestParam("file") MultipartFile file) throws IOException {
        Map<String, Object> result = mediaServiceClient.uploadImage(id, file.getBytes(), file.getContentType());
        return ResponseEntity.ok(result);
    }

    /**
     * POST /images/{id}: Upload une image sur cet id (URL JSON {"url": "..."}).
     */
    @PostMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> uploadImageUrl(
            @PathVariable("id") String id,
            @RequestBody Map<String, String> payload) {
        String remoteUrl = payload.get("url");
        Map<String, Object> result = mediaServiceClient.uploadRemoteUrl(id, remoteUrl);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /images/{id}: Recuperer des infos sur cette image (taille, poids).
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getImageInfo(@PathVariable("id") String id) {
        Map<String, Object> info = mediaServiceClient.getImageInfo(id);
        return ResponseEntity.ok(info);
    }

    /**
     * GET /images/{id}/blob: Recuperer un blob de cette image (avec des options de taille).
     */
    @GetMapping("/{id}/blob")
    public ResponseEntity<byte[]> getImageBlob(
            @PathVariable("id") String id,
            @RequestParam(value = "w", required = false) Integer width,
            @RequestParam(value = "h", required = false) Integer height,
            @RequestParam(value = "size", required = false) String size) {
        ResponseEntity<byte[]> response = mediaServiceClient.getImageBlob(id, width, height, size);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("image/webp"));
        if (response.getHeaders().getETag() != null) {
            headers.setETag(response.getHeaders().getETag());
        }
        headers.setCacheControl("public, max-age=31536000, immutable");

        return new ResponseEntity<>(response.getBody(), headers, response.getStatusCode());
    }
}
