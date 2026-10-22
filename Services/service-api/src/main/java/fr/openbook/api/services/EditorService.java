package fr.openbook.api.services;

import fr.openbook.api.dtos.CreateEditorDTO;
import fr.openbook.api.dtos.EditorDTO;
import fr.openbook.api.dtos.UpdateEditorDTO;
import fr.openbook.api.entities.EditorEntity;
import fr.openbook.api.repositories.EditorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EditorService {

    @Autowired
    private EditorRepository editorRepository;

    public List<EditorDTO> getAllEditors() {
        return editorRepository.findAll().stream().map(EditorService::entityToDTO).toList();
    }

    public EditorDTO getEditorById(Long id) {
        EditorEntity editorEntity = editorRepository.findById(id).orElse(null);

        if (editorEntity == null) {
            return null;
        }

        return entityToDTO(editorEntity);
    }

    public EditorDTO createEditor(CreateEditorDTO editorDTO) {
        EditorEntity editorEntity = new EditorEntity();
        editorEntity.setName(editorDTO.getName());

        return entityToDTO(editorRepository.save(editorEntity));
    }

    public EditorDTO updateEditor(UpdateEditorDTO editorDTO) {
        EditorEntity editorEntity = editorRepository.findById(editorDTO.getId()).orElse(null);

        if (editorEntity == null) {
            return null;
        }

        editorEntity.setName(editorDTO.getName());

        return entityToDTO(editorRepository.save(editorEntity));
    }

    public void deleteEditor(Long id) {
        editorRepository.deleteById(id);
    }

    public static EditorDTO entityToDTO(EditorEntity entity) {
        if (entity == null) return null;
        EditorDTO entityDTO = new EditorDTO();
        entityDTO.setId(entity.getId());
        entityDTO.setName(entity.getName());
        return entityDTO;
    }
}