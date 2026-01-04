import { config as dotenvConfig } from 'dotenv'
dotenvConfig()

console.log('PORT from process.env:', process.env.PORT);

const _config = {
    port: process.env.PORT || 3000,
    mongoURL: process.env.MONGO_CONNECTION_STRING,
    env: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUDNAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
    apiBase: process.env.ELECTRON_APP_API_BASE,
    url: process.env.UPDATE_SERVER_URL,
    cashAccountId: process.env.CASH_ACCOUNT_ID,
    bankAccountId: process.env.BANK_ACCOUNT_ID,
    cashClientId: process.env.CASH_CLIENT_ID,
    bankClientId: process.env.BANK_CLIENT_ID,
}

export const config = Object.freeze(_config)