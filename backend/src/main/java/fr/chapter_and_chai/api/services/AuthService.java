package fr.chapter_and_chai.api.services;

import fr.chapter_and_chai.api.dtos.auth.LoginRequestDTO;
import fr.chapter_and_chai.api.dtos.auth.LoginResponseDTO;
import fr.chapter_and_chai.api.dtos.auth.RegisterRequestDTO;
import fr.chapter_and_chai.api.dtos.auth.RegisterResponseDTO;
import fr.chapter_and_chai.api.entities.UserEntity;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@Service
@AllArgsConstructor
public class AuthService {

    private final RepositoryService repositoryService;
    private final BCryptPasswordEncoder bCryptPasswordEncoder;
    private final AuthenticationManager authenticationManager;

    public RegisterResponseDTO register(@NonNull RegisterRequestDTO user)
    {
        if (repositoryService.getUserRepository()
                .existsByUsernameOrEmail(user.getUsername(), user.getEmail()))
            return null;

        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(user.getUsername());
        userEntity.setEmail(user.getEmail());
        userEntity.setPassword(bCryptPasswordEncoder.encode(user.getPassword()));

        userEntity = repositoryService.getUserRepository().save(userEntity);

        return new RegisterResponseDTO(userEntity.getId());
    }

    public UserEntity login(@NonNull LoginRequestDTO loginDTO) {
        Optional<UserEntity> result = repositoryService.getUserRepository().findByEmail(loginDTO.getEmail());

        if (result.isEmpty())
            return null;

        UserEntity userEntity = result.get();

        if (!bCryptPasswordEncoder.matches(loginDTO.getPassword(), userEntity.getPassword()))
            return null;

        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
            loginDTO.getEmail(),
            loginDTO.getPassword()
        ));

        return result.get();
    }

    public void logout(@NonNull HttpSession session, @NonNull HttpServletResponse response) {
        session.invalidate();
    }
}