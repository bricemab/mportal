// ExcludeFromJson.ts
export function ExcludeFromJson(target: any, propertyKey: string) {
  // Initialisation du tableau __excludedProps pour chaque entité
  if (!target.constructor.__excludedProps) {
    target.constructor.__excludedProps = [];
  }

  // On ajoute la propriété à la liste des exclusions
  target.constructor.__excludedProps.push(propertyKey);
}
