package fr.openbook.media.service;

import com.luciad.imageio.webp.WebPWriteParam;
import fr.openbook.media.config.MediaProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaProcessingService {

    private final MediaProperties properties;

    public record ProcessResult(byte[] data, int width, int height) {}

    /**
     * Decodes any supported image format (JPEG, PNG, GIF, WebP),
     * downsizes to fit within (maxWidth, maxHeight) preserving aspect ratio,
     * and encodes to WebP format.
     */
    public ProcessResult processMaster(byte[] inputBytes) throws IOException {
        log.info("[CONVERSION] Début du traitement de l'image maître (taille brute: {} octets)", inputBytes.length);
        BufferedImage image = decodeImage(inputBytes);
        if (image == null) {
            log.error("[CONVERSION] Échec du décodage de l'image: format corrompu ou non supporté");
            throw new IOException("Failed to decode image: unsupported or corrupt image format");
        }

        int origW = image.getWidth();
        int origH = image.getHeight();

        BufferedImage processed = image;
        if (origW > properties.getMaxWidth() || origH > properties.getMaxHeight()) {
            log.info("[REDIMENSIONNEMENT] Réduction de l'image maître: {}x{} -> max {}x{}",
                    origW, origH, properties.getMaxWidth(), properties.getMaxHeight());
            processed = Thumbnails.of(image)
                    .size(properties.getMaxWidth(), properties.getMaxHeight())
                    .asBufferedImage();
            log.info("[REDIMENSIONNEMENT] Nouvelles dimensions après réduction: {}x{}",
                    processed.getWidth(), processed.getHeight());
        } else {
            log.info("[REDIMENSIONNEMENT] Dimensions {}x{} conformes aux limites maximales ({}x{}), aucun redimensionnement requis",
                    origW, origH, properties.getMaxWidth(), properties.getMaxHeight());
        }

        int finalW = processed.getWidth();
        int finalH = processed.getHeight();

        long startEncode = System.currentTimeMillis();
        byte[] webpBytes = encodeWebp(processed, properties.getWebpQuality());
        long encodeDuration = System.currentTimeMillis() - startEncode;
        log.info("[ENCODAGE] Image maître encodée en WebP: {}x{}, {} octets (qualité={}) en {} ms",
                finalW, finalH, webpBytes.length, properties.getWebpQuality(), encodeDuration);
        return new ProcessResult(webpBytes, finalW, finalH);
    }

    /**
     * Resizes a master WebP image to target dimensions and re-encodes to WebP.
     */
    public byte[] resizeFromMaster(byte[] masterBytes, int targetW, int targetH) throws IOException {
        log.info("[REDIMENSIONNEMENT] Génération d'une variante vers targetW={}, targetH={}", targetW, targetH);
        BufferedImage image = decodeImage(masterBytes);
        if (image == null) {
            log.error("[CONVERSION] Échec du décodage de l'image maître pour variante");
            throw new IOException("Failed to decode master image");
        }

        Thumbnails.Builder<BufferedImage> builder = Thumbnails.of(image);
        if (targetW > 0 && targetH > 0) {
            builder.size(targetW, targetH);
        } else if (targetW > 0) {
            builder.width(targetW);
        } else if (targetH > 0) {
            builder.height(targetH);
        }

        BufferedImage resized = builder.asBufferedImage();
        log.info("[REDIMENSIONNEMENT] Variante redimensionnée avec succès: {}x{}", resized.getWidth(), resized.getHeight());

        long startEncode = System.currentTimeMillis();
        byte[] resizedWebp = encodeWebp(resized, properties.getWebpQuality());
        long encodeDuration = System.currentTimeMillis() - startEncode;
        log.info("[ENCODAGE] Variante encodée en WebP: {} octets en {} ms", resizedWebp.length, encodeDuration);
        return resizedWebp;
    }

    /**
     * Decodes an image from byte array.
     */
    public BufferedImage decodeImage(byte[] inputBytes) throws IOException {
        try (InputStream in = new ByteArrayInputStream(inputBytes)) {
            BufferedImage img = ImageIO.read(in);
            if (img != null) {
                log.info("[CONVERSION] Image décodée avec succès: {}x{}, type={}",
                        img.getWidth(), img.getHeight(), img.getType());
            }
            return img;
        }
    }

    /**
     * Encodes a BufferedImage into WebP format using sejda webp-imageio.
     */
    public byte[] encodeWebp(BufferedImage image, float quality) throws IOException {
        BufferedImage formattedImage = ensureRgbCompatible(image);

        Iterator<ImageWriter> writers = ImageIO.getImageWritersByMIMEType("image/webp");
        if (!writers.hasNext()) {
            writers = ImageIO.getImageWritersByFormatName("webp");
        }
        if (!writers.hasNext()) {
            throw new IllegalStateException("No WebP ImageWriter found in classpath");
        }

        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
            writer.setOutput(ios);

            ImageWriteParam writeParam = writer.getDefaultWriteParam();
            if (writeParam instanceof WebPWriteParam webpParam) {
                webpParam.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                webpParam.setCompressionType(webpParam.getCompressionTypes()[WebPWriteParam.LOSSY_COMPRESSION]);
                float q = Math.max(0.01f, Math.min(1.0f, quality > 1.0f ? quality / 100.0f : quality));
                webpParam.setCompressionQuality(q);
            }

            writer.write(null, new IIOImage(formattedImage, null, null), writeParam);
            ios.flush();
            return baos.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    private BufferedImage ensureRgbCompatible(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB || image.getType() == BufferedImage.TYPE_INT_ARGB) {
            return image;
        }
        boolean hasAlpha = image.getColorModel() != null && image.getColorModel().hasAlpha();
        int targetType = hasAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage formatted = new BufferedImage(image.getWidth(), image.getHeight(), targetType);
        Graphics2D g = formatted.createGraphics();
        g.drawImage(image, 0, 0, null);
        g.dispose();
        return formatted;
    }
}
