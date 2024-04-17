const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const multer = require("multer");
// -----------------------------------------------
const app = express.Router();
const connection = require("./connectDB");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

connection.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
  } else {
    console.log("Connected to MySQL");
  }
});
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "your_secret_key", 
    resave: false,
    saveUninitialized: true,
  })
);


app.post("/login", (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const query = `SELECT * FROM users WHERE (username = $1 OR email = $2)`;
  connection.query(
    query,
    [usernameOrEmail, usernameOrEmail],
    (err, results) => {
      if (err) {
        console.error("Error during login:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        if (results.rows.length > 0) {
          const user = results.rows[0];
          bcrypt.compare(password, user.password, (bcryptErr, bcryptResult) => {
            if (bcryptErr) {
              console.error("Error during bcrypt compare:", bcryptErr);
              res.status(500).json({ error: "Internal Server Error" });
            } else if (bcryptResult) {
              req.session.user = {
                user_id: user.user_id,
                username: user.username,
              };
              res.cookie("loggedIn", true);
              res.json({
                success: true,
                user_id: user.user_id,
                username: user.username,
              });
            } else {
              res.status(401).json({
                error: "Sai thông tin hoặc password. Vui lòng nhập lại !",
              });
            }
          });
        } else {
          res.status(401).json({
            error: "Sai thông tin hoặc password. Vui lòng nhập lại !",
          });
        }
      }
    }
  );
});
app.post("/loginadmin", (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const query = `SELECT * FROM admins WHERE (username = $1)`;
  connection.query(query, [usernameOrEmail], (err, results) => {
    if (err) {
      console.error("Error during login:", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      if (results.rows.length > 0) {
        const user = results.rows[0];
        bcrypt.compare(password, user.password, (bcryptErr, bcryptResult) => {
          if (bcryptErr) {
            console.error("Error during bcrypt compare:", bcryptErr);
            res.status(500).json({ error: "Internal Server Error" });
          } else if (bcryptResult) {
            req.session.user = {
              admin_id: user.admin_id,
              usernameadmin: user.username,
            };
            res.cookie("loggedInAdmin", true);
            res.json({
              success: true,
              admin_id: user.admin_id,
              usernameadmin: user.username,
            });
          } else {
            res.status(401).json({
              error: "Sai thông tin hoặc password. Vui lòng nhập lại !",
            });
          }
        });
      } else {
        res.status(401).json({
          error: "Sai thông tin hoặc password. Vui lòng nhập lại !",
        });
      }
    }
  });
});

app.post("/register", (req, res) => {
  const { username, password, email } = req.body;

  const checkUserQuery =
    "SELECT * FROM users WHERE username = $1 OR email = $2";
  connection.query(checkUserQuery, [username, email], (err, results) => {
    if (err) {
      console.error("Error during user registration:", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      if (results.rows.length > 0) {
        if (results.rows[0].username === username) {
          res.status(400).json({ error: "Username đã tồn tại" });
        } else if (results.rows[0].email === email) {
          res.status(400).json({ error: "Email đã tồn tại" });
        }
      } else {
        bcrypt.hash(password, 10, (bcryptErr, hash) => {
          if (bcryptErr) {
            console.error("Error during password hashing:", bcryptErr);
            res.status(500).json({ error: "Failed to hash password" });
          } else {
            const insertUserQuery =
              "INSERT INTO users (username, password, email) VALUES ($1, $2, $3)";
            connection.query(
              insertUserQuery,
              [username, hash, email],
              (insertErr, insertResults) => {
                if (insertErr) {
                  console.error("Error during user registration:", insertErr);
                  res.status(500).json({ error: "Failed to register user" });
                } else {
                  res.status(200).json({ success: true });
                }
              }
            );
          }
        });
      }
    }
  });
});

app.post("/add-news", upload.single("image"), (req, res) => {
  const { title, content, category_id, user_id, status } = req.body;
  const image = req.file ? req.file.buffer : null;

  const query = `INSERT INTO news (title, content, category_id, user_id, created_at, status) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING news_id`;
  connection.query(
    query,
    [title, content, category_id, user_id, status],
    (err, results) => {
      if (err) {
        console.error("Error during adding news:", err);
        res.status(500).json({ error: "Failed to add news" });
      } else {
        const newsId = results.rows[0].news_id;
        if (image) {
          const imageQuery = `INSERT INTO images (news_id, image_blob) VALUES ($1, $2)`;
          connection.query(imageQuery, [newsId, image], (imageErr, imageResults) => {
            if (imageErr) {
              console.error("Error during adding image:", imageErr);
              res.status(500).json({ error: "Failed to add image" });
            } else {
              res.status(200).json({ success: true });
            }
          });
        } else {
          res.status(200).json({ success: true });
        }
      }
    }
  );
});

app.get("/categories", (req, res) => {
  const query = "SELECT * FROM categories";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error during fetching categories:", err);
      res.status(500).json({ error: "Failed to fetch categories" });
    } else {
      res.status(200).json(results.rows);
    }
  });
});
app.post("/add-category", (req, res) => {
  const { name } = req.body;
  const query = `INSERT INTO categories (name) VALUES ($1)`;
  connection.query(query, [name], (err, results) => {
    if (err) {
      console.error("Error during adding category:", err);
      res.status(500).json({ error: "Failed to add category" });
    } else {
      res.status(200).json({ success: true });
    }
  });
});
app.get("/news-with-images", (req, res) => {
  const query = `
   SELECT news.*, images.image_blob, users.username AS user_name, categories.name AS category_name
    FROM news
    LEFT JOIN images ON news.news_id = images.news_id
    LEFT JOIN users ON news.user_id = users.user_id
    LEFT JOIN categories ON news.category_id = categories.category_id
    WHERE news.status = 'approved'
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error during fetching approved news with images:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch approved news with images" });
    } else {
      results.rows.forEach((news) => {
        if (news.image_blob) {
          news.image_blob = `data:image/png;base64,${Buffer.from(
            news.image_blob,
            "binary"
          ).toString("base64")}`;
        }
      });
      res.status(200).json(results.rows);
    }
  });
});
app.get("/news-with-images-all", (req, res) => {
  const query = `
   SELECT news.*, images.image_blob, users.username AS user_name, categories.name AS category_name
    FROM news
    LEFT JOIN images ON news.news_id = images.news_id
    LEFT JOIN users ON news.user_id = users.user_id
    LEFT JOIN categories ON news.category_id = categories.category_id
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error during fetching news with images:", err);
      res.status(500).json({ error: "Failed to fetch news with images" });
    } else {
      results.rows.forEach((news) => {
        if (news.image_blob) {
          news.image_blob = `data:image/png;base64,${Buffer.from(
            news.image_blob,
            "binary"
          ).toString("base64")}`;
        }
      });
      res.status(200).json(results.rows);
    }
  });
});

app.get("/api/news-by-user", (req, res) => {
  const userId = req.query.user_id;

  const query = `
    SELECT news.*, images.image_blob, categories.name AS category_name
    FROM news
    LEFT JOIN images ON news.news_id = images.news_id
    LEFT JOIN categories ON news.category_id = categories.category_id
    WHERE news.user_id = $1
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error during fetching news by user:", err);
      res.status(500).json({ error: "Failed to fetch news by user" });
    } else {
      results.rows.forEach((news) => {
        if (news.image_blob) {
          news.image_blob = `data:image/png;base64,${Buffer.from(
            news.image_blob,
            "binary"
          ).toString("base64")}`;
        }
      });
      res.status(200).json(results.rows);
    }
  });
});

app.get("/news/:id", (req, res) => {
  const newsId = req.params.id;
  const query = `
    SELECT news.*, images.image_blob, users.username AS user_name, categories.name AS category_name
    FROM news
    LEFT JOIN images ON news.news_id = images.news_id
    LEFT JOIN users ON news.user_id = users.user_id
    LEFT JOIN categories ON news.category_id = categories.category_id
    WHERE news.news_id = $1
  `;
  connection.query(query, [newsId], (err, results) => {
    if (err) {
      console.error("Error during fetching news details:", err);
      res.status(500).json({ error: "Failed to fetch news details" });
    } else {
      results.rows.forEach((news) => {
        if (news.image_blob) {
          news.image_blob = `data:image/png;base64,${Buffer.from(
            news.image_blob,
            "binary"
          ).toString("base64")}`;
        }
      });
      res.status(200).json(results.rows);
    }
  });
});
app.put("/update-news-status/:newsId", (req, res) => {
  const { newsId } = req.params;
  const { status, note } = req.body;

  const query = `UPDATE news SET status = $1, note = $2 WHERE news_id = $3`;

  connection.query(query, [status, note, newsId], (err, results) => {
    if (err) {
      console.error("Error during updating news status:", err);
      res.status(500).json({ error: "Failed to update news status" });
    } else {
      res.status(200).json({ success: true });
    }
  });
});





// -----------------------------------------------
module.exports = app;
