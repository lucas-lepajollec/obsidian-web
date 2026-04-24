---
title: Fonctionnalités Avancées
tags: [tutoriel, avancé, latex, callout]
---

# Fonctionnalités Avancées

Obsidian-Web supporte les fonctionnalités avancées d'Obsidian.

## Callouts

> [!note] Note
> Ceci est un callout de type **note**. Utilisez-le pour ajouter du contexte.

> [!tip] Astuce
> Les astuces sont parfaites pour partager des bonnes pratiques.

> [!warning] Attention
> Faites attention à sauvegarder vos notes régulièrement !

> [!info] Information
> Obsidian-Web est basé sur Next.js 15 et CodeMirror 6.

> [!example] Exemple
> Voici un exemple de configuration Docker :
> ```yaml
> services:
>   obsidian-web:
>     image: obsidian-web
>     ports:
>       - "2506:3000"
>     volumes:
>       - /chemin/vers/vault:/app/vault
> ```

> [!caution] Danger
> Ne partagez jamais votre mot de passe d'édition publiquement.

## Mathématiques (LaTeX)

Formule en ligne : $E = mc^2$

Formule en bloc :

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

La formule quadratique :

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

Série de Taylor :

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n
$$

## Wikilinks

Les wikilinks permettent de naviguer entre les notes :
- [[Bienvenue]] — Page d'accueil
- [[Syntaxe Markdown]] — Syntaxe de base
- [[Journal de Bord]] — Notes quotidiennes

### Avec alias

Vous pouvez utiliser un alias : [[Bienvenue|Retour à l'accueil]]

## Frontmatter

Le frontmatter YAML est affiché en haut de chaque note. Il contient les métadonnées comme le titre, les tags, et la date.

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Sauvegarder |
| Clic éditeur | Basculer en mode édition |
| Clic lecture | Basculer en mode lecture |

#avancé #latex #callout
