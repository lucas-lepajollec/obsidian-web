---
title: Syntaxe Markdown
tags: [tutoriel, markdown]
---

# Syntaxe Markdown

Cette note présente les principales syntaxes Markdown supportées par ShardNote.

## Texte de base

Voici du texte **gras**, *italique*, ~~barré~~ et ==surligné==.

Un [lien externe](https://commonmark.org) et un lien interne : [[Bienvenue]].

## Listes

### Liste à puces
- Premier élément
- Deuxième élément
  - Sous-élément
  - Autre sous-élément
- Troisième élément

### Liste numérotée
1. Première étape
2. Deuxième étape
3. Troisième étape

### Tâches
- [x] Installer ShardNote
- [x] Explorer le coffre démo
- [ ] Créer ma première note
- [ ] Configurer Docker

## Citations

> La connaissance est un trésor, mais la pratique en est la clé.
> — Thomas Fuller

## Code

Code en ligne : `console.log("Bonjour le monde")` 

Bloc de code :

```javascript
function saluer(nom) {
  return `Bonjour, ${nom} ! 👋`;
}

console.log(saluer("ShardNote"));
```

```python
def fibonacci(n):
    """Calcule la suite de Fibonacci."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fibonacci(10))  # 55
```

## Tableaux

| Syntaxe | Résultat | Description |
|---------|----------|-------------|
| `**gras**` | **gras** | Met en gras |
| `*italique*` | *italique* | Met en italique |
| `~~barré~~` | ~~barré~~ | Texte barré |
| `==surligné==` | ==surligné== | Surlignage |
| `[[ lien ]]` | [[Bienvenue]] | Wikilink |

## Images

Les images sont supportées avec la syntaxe standard Markdown.

## Séparateur

---

## Tags

#markdown #syntaxe #tutoriel

---

*Voir aussi : [[Fonctionnalités Avancées]]*
