const express = require("express");
const mysql = require("mysql");
const path = require("path");

const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "12112004",
    database: "transport_company"
});

db.connect(err => {
    if (err) console.error("MySQL connection error:", err);
    else console.log("MySQL connected");
});

// --- AUTH ROUTES ---
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username=? AND password=?", [username, password], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.sqlMessage });
        if (!result.length) return res.json({ success: false });

        const user = result[0];
        res.json({ success: true, role: user.role, branch: user.branch });
    });
});

app.post("/register", (req, res) => {
    const { username, password } = req.body;
    db.query("INSERT INTO users(username,password,role) VALUES(?,?,?)", [username, password, "user"], (err) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json({ success: true });
    });
});

// --- ACCOUNT ROUTES ---
app.post("/account/details", (req, res) => {
    const { username, personal_detail } = req.body; 

    if (!username || !personal_detail) {
        return res.status(400).json({ success: false, error: "Missing username or personal details" });
    }

    db.query(
        "UPDATE users SET personal_detail = ? WHERE username = ?",
        [personal_detail, username],
        (err, result) => {
            if (err) {
                console.error("Error saving account details:", err);
                return res.status(500).json({ success: false, error: err.sqlMessage });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: "User not found or no change made" });
            }
            
            return res.json({ success: true });
        }
    );
});

// GET user's account details for checking status in script.js (used by requestTruck)
app.get("/account/details", (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ success: false, error: "Missing username" });

    db.query("SELECT personal_detail, branch FROM users WHERE username = ?", [username], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.sqlMessage });
        if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });
        res.json(rows[0]);
    });
});

// --- TRUCK ROUTES ---
app.post("/addTruck", (req, res) => {
    const { plate_no, model, contact, insurance, status, branch } = req.body;
    db.query(
        "INSERT INTO trucks(plate_no, model, contact, insurance, status, branch) VALUES(?,?,?,?,?,?)",
        [plate_no, model, contact, insurance, status, branch],
        err => err ? res.json({ success: false, error: err.sqlMessage }) : res.json({ success: true })
    );
});

app.post("/deleteTruck", (req, res) => {
    const { id } = req.body;
    db.query("DELETE FROM trucks WHERE id=?", [id], err => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json({ success: true });
    });
});

// Get all trucks (filtered by branch or search term)
app.get("/trucks", (req, res) => {
    const search = req.query.search || "";
    const userBranch = req.query.branch || "";

    let sql = "";
    let params = [];

    if (search && userBranch) {
        // Manager searching ONLY by Model or Plate No
        sql = `SELECT * FROM trucks 
               WHERE (model LIKE ? OR plate_no LIKE ?) 
               AND branch = ?`;
        params = [`%${search}%`, `%${search}%`, userBranch];

    } else if (search) {
        // Admin searching by Model, Plate No, OR Branch
        sql = `SELECT * FROM trucks 
               WHERE model LIKE ? 
               OR plate_no LIKE ? 
               OR branch LIKE ?`;
        params = [`%${search}%`, `%${search}%`, `%${search}%`];

    } else if (userBranch) {
        sql = "SELECT * FROM trucks WHERE branch = ?";
        params = [userBranch];

    } else {
        sql = "SELECT * FROM trucks";
        params = [];
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });

        const withPermissions = results.map(t => ({
            ...t,
            canUpdate: userBranch ? t.branch === userBranch : true
        }));

        res.json(withPermissions);
    });
});

app.get("/trucks/recent", (req, res) => {
    const userBranch = req.query.branch || "";

    let sql = "SELECT * FROM trucks ORDER BY id DESC LIMIT 7";
    let params = [];

    db.query(sql, params, (err, results) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });

        const withPermissions = results
            .filter(t => !userBranch || t.branch === userBranch)
            .map(t => ({
                ...t,
                canUpdate: !userBranch || t.branch === userBranch
            }));

        res.json(withPermissions);
    });
});

app.post("/updateStatus", (req, res) => {
    const { id } = req.body;
    db.query("SELECT status FROM trucks WHERE id=?", [id], (err, result) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        if (!result.length) return res.json({ success: false, error: "Truck not found" });

        const newStatus = result[0].status === "OK" ? "Unavailable" : "OK";
        db.query("UPDATE trucks SET status=? WHERE id=?", [newStatus, id], err => {
            if (err) return res.json({ success: false, error: err.sqlMessage });
            res.json({ success: true });
        });
    });
});

// --- UPDATED Request a truck (users) ---
app.post("/requestTruck", (req, res) => {
    const { username, truck_id, email } = req.body;
    
    if (!username || !truck_id || !email) {
        return res.status(400).json({ success: false, error: "Missing data" });
    }

    // 1) Check user exists and has saved personal_detail
    db.query("SELECT personal_detail FROM users WHERE username = ?", [username], (err, rows) => {
        if (err) {
            console.error("Query 1 Error (User Check):", err.sqlMessage);
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        if (!rows.length) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const user = rows[0];
        if (!user.personal_detail) {
            // This is the check for account details
            return res.json({ success: false, needDetails: true });
        }

        // 2) Add truck_id to the user's truck_ids JSON array
        const updateSql = `
            UPDATE users 
            SET truck_ids = JSON_ARRAY_APPEND(COALESCE(truck_ids, '[]'), '$', CAST(? AS UNSIGNED)) 
            WHERE username = ?
        `;

        db.query(updateSql, [truck_id, username], (err2, result2) => {
            if (err2) {
                console.error("Query 2 (truck_ids update) CRITICAL Error:", err2.sqlMessage);
                return res.status(500).json({ success: false, error: err2.sqlMessage });
            }

            // 3) Find truck's branch
            db.query("SELECT branch FROM trucks WHERE id = ?", [truck_id], (err3, truckRows) => {
                if (err3) {
                    console.error("Query 3 (find branch) Error:", err3.sqlMessage);
                    
                    // return an error.
                    return res.status(500).json({ success: false, error: err3.sqlMessage });
                }
                if (!truckRows.length) {
                    // Even if user's truck_ids was updated, can't find the branch to update request_count
                    return res.status(404).json({ success: false, error: "Truck not found for branch update" });
                }

                const branch = truckRows[0].branch;

                // 4) Increment branch_requests.request_count
                db.query("UPDATE branch_requests SET request_count = request_count + 1 WHERE branch_name = ?", [branch], (err4, updRes) => {
                    if (err4) {
                        console.error("Query 4 (request count update) Error:", err4.sqlMessage);
                        return res.status(500).json({ success: false, error: err4.sqlMessage });
                    }

                    if (updRes.affectedRows > 0) {
                        // Success path: existing branch request count updated
                        return res.json({ success: true, email });
                    } else {
                        // Insert new row if branch didn't exist
                        db.query("INSERT INTO branch_requests (branch_name, request_count) VALUES (?, 1)", [branch], (err5) => {
                            if (err5) {
                                console.error("Query 5 (request count insert) Error:", err5.sqlMessage);
                                return res.status(500).json({ success: false, error: err5.sqlMessage });
                            }
                            // Success path: new branch request count inserted
                            return res.json({ success: true, email });
                        });
                    }
                });
            });
        });
    });
});

// --- Get user's requested truck rows ---
app.get("/user/requests", (req, res) => {
    const username = req.query.username;
    if (!username) return res.status(400).json({ success: false, error: "Missing username" });

    db.query("SELECT truck_ids FROM users WHERE username = ?", [username], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.sqlMessage });
        if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });

        const truckIdsRaw = rows[0].truck_ids;
        if (!truckIdsRaw) return res.json([]);

        let truckIds = truckIdsRaw;
        
        // Handle the JSON field being returned as a string by the MySQL driver
        if (typeof truckIdsRaw === "string") {
            try {
                truckIds = JSON.parse(truckIdsRaw);
            } catch (parseErr) {
                console.error("Failed to parse truck_ids:", parseErr);
                return res.json([]);
            }
        }

        if (!Array.isArray(truckIds) || truckIds.length === 0) return res.json([]);

        // Filter out non-numeric IDs and ensure they are integers for the query
        const numericTruckIds = truckIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (numericTruckIds.length === 0) return res.json([]);

        // fetch truck rows (using WHERE id IN to select all requested trucks)
        db.query("SELECT * FROM trucks WHERE id IN (?)", [numericTruckIds], (err2, truckRows) => {
            if (err2) return res.status(500).json({ success: false, error: err2.sqlMessage });
            res.json(truckRows);
        });
    });
});

// --- USER & MANAGER ROUTES ---
app.get("/users", (req, res) => {
    const search = req.query.search || "";
    db.query("SELECT * FROM users WHERE username LIKE ?", [`%${search}%`], (err, results) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json(results);
    });
});

app.post("/users/upgrade", (req, res) => {
    const { id, newRole } = req.body;
    db.query("UPDATE users SET role=? WHERE id=?", [newRole, id], err => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json({ success: true });
    });
});

app.get("/managers", (req, res) => {
    const search = req.query.search || "";
    db.query("SELECT *, DATE_FORMAT(joined, '%Y-%m-%d') AS joined_str FROM users WHERE role='manager' AND username LIKE ?",
        [`%${search}%`],
        (err, results) => {
            if (err) return res.json({ success: false, error: err.sqlMessage });
            res.json(results.map(r => ({ ...r, joined: r.joined_str })));
        }
    );
});

app.post("/managers/edit", (req, res) => {
    const { id, branch, salary, joined } = req.body;
    if (!id) return res.status(400).json({ success: false, error: "Missing manager ID" });

    db.query("UPDATE users SET branch=?, salary=?, joined=? WHERE id=?", [branch, salary, joined, id], err => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json({ success: true });
    });
});

// --- CONTACT ROUTES ---
app.post("/contact", (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.json({ success: false, error: "All fields are required" });

    db.query("INSERT INTO contacts(name,email,message) VALUES(?,?,?)", [name, email, message], err => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json({ success: true });
    });
});

app.post("/contactAdmin", (req, res) => {
    const { message, managerName, managerEmail } = req.body;
    if (!message) return res.json({ success: false, error: "Message cannot be empty" });

    db.query("INSERT INTO contacts(name,email,message) VALUES(?,?,?)", ["Manager: " + managerName, managerEmail || "", message], err => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json({ success: true });
    });
});

app.get("/contacts", (req, res) => {
    db.query("SELECT * FROM contacts ORDER BY id DESC", (err, results) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json(results);
    });
});

app.get("/contacts/search", (req, res) => {
    const query = req.query.query;
    if (!query) return res.json([]);

    const sql = "SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? ORDER BY id DESC";
    const likeQuery = `%${query}%`;
    db.query(sql, [likeQuery, likeQuery], (err, results) => {
        if (err) return res.json({ success: false, error: err.sqlMessage });
        res.json(results);
    });
});

// --- STATS ---
app.get("/branchSummary", (req, res) => {
    const sql = "SELECT branch_name AS branch, request_count AS count FROM branch_requests";
    
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching branch request summary:", err.sqlMessage);
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }

        const summary = {};
        result.forEach(r => summary[r.branch] = r.count);
        res.json(summary);
    });
});

// --- START SERVER ---
app.listen(3000, () => console.log("Server running on port 3000"));