// Configuration lue dans l'environnement (fichier /etc/mportal/api.env sur le serveur,
// chargé par `node --env-file`). Aucun secret dans ce fichier.

const env = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
};

const jwtExpiresIn = env("MPORTAL_JWT_EXPIRES_IN", "1d");

const config = {
  isDevModeEnabled: process.env.NODE_ENV !== "production",
  server: {
    // Noms propres à MPortal : Coolify injecte ses propres HOST/PORT dans les conteneurs.
    host: env("MPORTAL_LISTEN_HOST", "127.0.0.1"),
    port: Number(env("MPORTAL_LISTEN_PORT", "4370")),
  },
  database: {
    host: env("MPORTAL_DB_HOST", "127.0.0.1"),
    port: Number(env("MPORTAL_DB_PORT", "3307")),
    username: env("MPORTAL_DB_USER"),
    password: env("MPORTAL_DB_PASSWORD"),
    database: env("MPORTAL_DB_NAME", "mportal"),
  },
  security: {
    jwt: {
      secret: env("MPORTAL_JWT_SECRET"),
      expiresIn: /^\d+$/.test(jwtExpiresIn) ? Number(jwtExpiresIn) : jwtExpiresIn,
    },
    hmacSecretKey: env("MPORTAL_HMAC_SECRET"),
  },
  mdev: {
    bank: {
      name: env("MPORTAL_BANK_NAME"),
      address: env("MPORTAL_BANK_ADDRESS"),
      number: env("MPORTAL_BANK_NUMBER"),
      postalCode: env("MPORTAL_BANK_POSTAL_CODE"),
      city: env("MPORTAL_BANK_CITY"),
      country: env("MPORTAL_BANK_COUNTRY", "CH"),
      iban: env("MPORTAL_BANK_IBAN"),
    },
  },
};

export default config;
