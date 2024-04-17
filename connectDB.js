const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const dbConfig = {
  connectionString: process.env.DB_CONNECTION_STRING,
  
};

const pool = new Pool(dbConfig);

module.exports = pool;
