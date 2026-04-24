# Obsidian-Web

Une interface web moderne, mobile-first, conçue pour naviguer, éditer et visualiser un coffre (vault) Obsidian directement depuis un navigateur.

## Déploiement avec Docker Compose (Recommandé)

La façon la plus simple de déployer Obsidian-Web sur un NAS ou un serveur est d'utiliser Docker Compose.

1. Créez un fichier `docker-compose.yml` (ou utilisez celui inclus) :

```yaml
services:
  obsidian-web:
    image: ghcr.io/VOTRE_UTILISATEUR/obsidian-web:latest
    # Si vous voulez build localement au lieu d'utiliser l'image :
    # build: .
    container_name: obsidian-web
    restart: unless-stopped
    ports:
      - "2506:3000"
    volumes:
      # Modifiez ce chemin pour pointer vers votre dossier Obsidian
      - /chemin/vers/votre/vault:/vault:rw
    environment:
      - NOTES_PATH=/vault
      # Définissez un mot de passe pour sécuriser l'édition
      - PERLITE_EDIT_PASSWORD=votre_mot_de_passe_secret
```

2. Lancez le conteneur :
```bash
docker-compose up -d
```

3. Accédez à l'application sur `http://<IP_DE_VOTRE_SERVEUR>:2506`

## Développement Local

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).
