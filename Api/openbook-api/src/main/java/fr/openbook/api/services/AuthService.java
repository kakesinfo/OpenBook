package fr.openbook.api.services;

import fr.openbook.api.dtos.auth.LoginRequestDTO;
import fr.openbook.api.dtos.auth.RegisterRequestDTO;
import fr.openbook.api.dtos.auth.RegisterResponseDTO;
import fr.openbook.api.entities.UserEntity;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService
{
    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private BCryptPasswordEncoder bCryptPasswordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    public RegisterResponseDTO register(@NonNull RegisterRequestDTO user) {
        if (user.getUsername() == null || user.getUsername().trim().isEmpty())
            return null;

        String username = user.getUsername().trim();
        if (repositoryService.getUserRepository().existsByUsername(username))
            return null;

        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(username);
        userEntity.setPassword(bCryptPasswordEncoder.encode(user.getPassword()));

        userEntity = repositoryService.getUserRepository().save(userEntity);

        return new RegisterResponseDTO(userEntity.getId());
    }

    public UserEntity login(@NonNull LoginRequestDTO loginDTO) {
        if (loginDTO.getUsername() == null || loginDTO.getUsername().trim().isEmpty())
            return null;

        String identifier = loginDTO.getUsername().trim();
        Optional<UserEntity> result = repositoryService.getUserRepository().findByUsernameIgnoreCase(identifier);

        if (result.isEmpty())
            return null;

        UserEntity userEntity = result.get();

        if (userEntity.isBlocked()) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Ce compte a été suspendu ou bloqué par un administrateur.");
        }

        if (!bCryptPasswordEncoder.matches(loginDTO.getPassword(), userEntity.getPassword()))
            return null;

        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
            userEntity.getUsername(),
            loginDTO.getPassword()
        ));

        return userEntity;
    }

    public void logout(@NonNull HttpSession session, @NonNull HttpServletResponse response) {
        session.invalidate();
    }
}
