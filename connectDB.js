const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const dbConfig = {
  connectionString: process.env.POSTGRES_URL,
};

const pool = new Pool(dbConfig);

module.exports = pool;
