package fr.openbook.api.security;

import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.RepositoryService;
import lombok.AllArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@AllArgsConstructor
public class CustomUserDetailsService implements UserDetailsService
{
    private final RepositoryService repositoryService;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException
    {
        Optional<UserEntity> result = repositoryService.getUserRepository().findByEmail(email);

        if (result.isEmpty())
            throw new UsernameNotFoundException("User not found");

        return result.get();
    }
}
