package fr.openbook.api.services;

import fr.openbook.api.services.media.MediaService;
import fr.openbook.api.utils.MediaUrlUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AvatarService {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final int MAX_DIMENSION = 4096;
    private static final int TARGET_AVATAR_SIZE = 512;

    private static final byte[] PNG_SIGNATURE = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final Pattern UUID_EXTRACT_PATTERN = Pattern.compile("([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");

    private final MediaService mediaService;

    /**
     * Validates, sanitizes, resizes, and stores the avatar image via openbook-media (Cache/media-data).
     * Returns the public media URL (e.g. "/images/{uuid}/blob").
     */
    public String saveAvatar(MultipartFile file) throws IOException {
        // 1. File presence and size check
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Veuillez sélectionner un fichier image.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Le fichier est trop volumineux (maximum 5 Mo).");
        }

        // 2. Extension check
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            throw new IllegalArgumentException("Nom de fichier manquant.");
        }
        String lowerName = originalFilename.toLowerCase();
        if (!lowerName.endsWith(".jpg") && !lowerName.endsWith(".jpeg") && !lowerName.endsWith(".png")) {
            throw new IllegalArgumentException("Extension non autorisée. Seuls les fichiers JPG et PNG sont acceptés.");
        }

        // 3. MIME Content-Type check
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equalsIgnoreCase("image/jpeg") && !contentType.equalsIgnoreCase("image/png") && !contentType.equalsIgnoreCase("image/jpg"))) {
            throw new IllegalArgumentException("Type MIME invalide. Seuls les formats image/jpeg et image/png sont autorisés.");
        }

        // 4. Magic bytes inspection
        byte[] bytes = file.getBytes();
        if (bytes.length < 8) {
            throw new IllegalArgumentException("Fichier image corrompu ou trop petit.");
        }

        boolean isJpeg = bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF;
        boolean isPng = bytes[0] == PNG_SIGNATURE[0] && bytes[1] == PNG_SIGNATURE[1]
                && bytes[2] == PNG_SIGNATURE[2] && bytes[3] == PNG_SIGNATURE[3]
                && bytes[4] == PNG_SIGNATURE[4] && bytes[5] == PNG_SIGNATURE[5]
                && bytes[6] == PNG_SIGNATURE[6] && bytes[7] == PNG_SIGNATURE[7];

        if (!isJpeg && !isPng) {
            throw new IllegalArgumentException("Analyse de sécurité échouée : les octets magiques ne correspondent pas à une image JPG ou PNG valide.");
        }

        // 5. Decodability check & decompression bomb protection
        BufferedImage originalImage;
        try (InputStream is = new ByteArrayInputStream(bytes)) {
            originalImage = ImageIO.read(is);
        } catch (Exception e) {
            throw new IllegalArgumentException("Impossible de décoder l'image : fichier corrompu ou malicieux.");
        }

        if (originalImage == null) {
            throw new IllegalArgumentException("L'image est illisible ou contient des données malformées.");
        }

        int width = originalImage.getWidth();
        int height = originalImage.getHeight();
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("Dimensions d'image invalides.");
        }

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            throw new IllegalArgumentException("Dimensions d'image trop grandes (maximum 4096 x 4096 px).");
        }

        // 6. Sanitization and re-encoding in memory:
        // Drawing into a fresh BufferedImage strips all EXIF metadata, embedded scripts, and polyglot payloads.
        int targetWidth = width;
        int targetHeight = height;
        if (width > TARGET_AVATAR_SIZE || height > TARGET_AVATAR_SIZE) {
            if (width > height) {
                targetWidth = TARGET_AVATAR_SIZE;
                targetHeight = (int) ((double) height / width * TARGET_AVATAR_SIZE);
            } else {
                targetHeight = TARGET_AVATAR_SIZE;
                targetWidth = (int) ((double) width / height * TARGET_AVATAR_SIZE);
            }
        }

        BufferedImage sanitizedImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = sanitizedImage.createGraphics();
        try {
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.drawImage(originalImage, 0, 0, targetWidth, targetHeight, null);
        } finally {
            g2d.dispose();
        }

        byte[] sanitizedPngBytes;
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(sanitizedImage, "png", baos);
            sanitizedPngBytes = baos.toByteArray();
        }

        // 7. Store in openbook-media (converts to WebP and saves in Cache/media-data)
        String mediaUuid = mediaService.createVirtualImage();
        mediaService.uploadImage(mediaUuid, sanitizedPngBytes, "image/png");

        return MediaUrlUtils.formatCoverUrl(mediaUuid);
    }

    public void deleteAvatarFile(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) return;
        Matcher matcher = UUID_EXTRACT_PATTERN.matcher(avatarUrl);
        if (matcher.find()) {
            String uuid = matcher.group(1);
            try {
                mediaService.deleteImage(uuid);
            } catch (Exception ignored) {}
        }
    }
}
