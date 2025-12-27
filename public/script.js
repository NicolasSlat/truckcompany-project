const page = window.location.pathname.split("/").pop();

// --- GLOBAL STATE FOR MODAL ---
let _pendingRequest = { truck_id: null, plate_no: null, model: null };

// --- LOGIN & REGISTER ---
function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) return alert("Wrong login!");

            sessionStorage.setItem("username", username);
            sessionStorage.setItem("role", data.role);
            if (data.branch) sessionStorage.setItem("branch", data.branch);

            if (data.role === "admin") location.href = "admin.html";
            else if (data.role === "manager") location.href = "manager.html";
            else location.href = "user.html";
        })
        .catch(err => console.error("Login error:", err));
}

function register() {
    const username = document.getElementById("regUser").value;
    const password = document.getElementById("regPass").value;

    fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
        .then(r => r.json())
        .then(data => { if (data.success) alert("Registered!"); else alert("Register error: " + (data.error || "unknown")); })
        .catch(err => console.error("Register error:", err));
}

// --- SAVE ACCOUNT DETAILS (account_details.html uses onclick="saveDetails()") ---
function saveDetails() {
    const username = sessionStorage.getItem("username");
    if (!username) return alert("You're not logged in.");

    // Try to find a textarea/input with id personal_detail, otherwise prompt
    const el = document.getElementById("personal_detail") || document.getElementById("personalDetail");
    let personal_detail = "";

    if (el) personal_detail = el.value;
    else {
        personal_detail = prompt("Enter your personal details (JSON or free text):");
        if (personal_detail === null) return; // user cancelled
    }

    if (!personal_detail || !personal_detail.trim()) return alert("Please provide personal detail.");

    fetch("/account/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, personal_detail })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                alert("Details saved!");
                // go back to user dashboard if applicable
                if (page === "account_details.html") window.location.href = "user.html";
            } else {
                alert("Error saving details: " + (data.error || "unknown"));
            }
        })
        .catch(err => console.error("Save details error:", err));
}

// --- TRUCKS ---
function addTruck() {
    const truck = {
        plate_no: document.getElementById("pno").value,
        model: document.getElementById("model").value,
        contact: document.getElementById("contact").value,
        insurance: document.getElementById("insurance").value,
        status: "OK",
        branch: document.getElementById("branch").value
    };

    fetch("/addTruck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(truck) })
        .then(r => r.json())
        .then(data => {
            if (data.success) { alert("Truck added successfully!"); location.reload(); }
            else alert("Error adding truck: " + (data.error || "Unknown error"));
        }).catch(err => console.error("Add truck error:", err));
}

function loadAllTrucks() {
    const role = sessionStorage.getItem("role");
    const branch = sessionStorage.getItem("branch");

    let url = "/trucks";
    if (role === "manager" && branch) url += "?branch=" + encodeURIComponent(branch);

    fetch(url)
        .then(r => r.json())
        .then(data => {
            const box = document.getElementById("allTrucksBox");
            if (!box) return;
            box.style.display = "block";

            if (!Array.isArray(data) || !data.length) {
                box.innerHTML = "<p>No trucks found.</p>";
                return;
            }

            let html = `
                <table border="1" style="width:100%; border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Plate No</th>
                      <th>Model</th>
                      <th>Contact</th>
                      <th>Insurance</th>
                      <th>Status</th>
                      <th>Branch</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
            `;

            data.forEach((t, i) => {
                const roleNow = sessionStorage.getItem("role");
                let actions = "";
                if (roleNow === "admin" || (roleNow === "manager" && t.canUpdate)) actions += `<button onclick="updateStatus(${t.id})">Update Status</button> `;
                if (roleNow === "admin") actions += `<button onclick="deleteTruck(${t.id})">Delete Truck</button> `;
                
                // Request button only for normal users
                if (roleNow === "user") actions += `<button onclick="requestTruck(${t.id}, '${t.plate_no.replace(/'/g, "\\'")}', '${t.model.replace(/'/g, "\\'")}')">Request Truck</button>`;
                html += `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${t.plate_no}</td>
                    <td>${t.model}</td>
                    <td>${t.contact}</td>
                    <td>${t.insurance}</td>
                    <td>${t.status}</td>
                    <td>${t.branch}</td>
                    <td>${actions}</td>
                  </tr>
                `;
            });

            html += "</tbody></table>";
            box.innerHTML = html;
        })
        .catch(err => {
            console.error("Error loading all trucks:", err);
            const box = document.getElementById("allTrucksBox");
            if (box) box.innerHTML = "<p>Error loading trucks.</p>";
        });
}

function loadTrucks(boxId = "truckList") {
    const box = document.getElementById(boxId);
    if (!box) return;

    fetch("/trucks?branch=" + encodeURIComponent(sessionStorage.getItem("branch") || ""))
        .then(r => r.json())
        .then(data => {
            const roleNow = sessionStorage.getItem("role");
            box.innerHTML = data.length ? data.map(t => {
                const reqBtn = roleNow === "user" ? `<button onclick="requestTruck(${t.id}, '${t.plate_no.replace(/'/g, "\\'")}', '${t.model.replace(/'/g, "\\'")}')">Request Truck</button>` : "";
                return `
                  <div>
                    <b>Plate No:</b> ${t.plate_no}<br>
                    <b>Model:</b> ${t.model}<br>
                    <b>Contact:</b> ${t.contact}<br>
                    <b>Insurance:</b> ${t.insurance}<br>
                    <b>Status:</b> ${t.status}<br>
                    <b>Branch:</b> ${t.branch}<br>
                    ${reqBtn}
                  </div>`;
            }).join("") : "<p>No trucks yet.</p>";
        })
        .catch(err => console.error("loadTrucks error:", err));
}

function searchTrucks() {
    const s = document.getElementById("truckSearch").value.trim();
    if (!s) return alert("Please enter a search term.");

    const box = document.getElementById("truckSearchResults");
    if (!box) return;

    const role = sessionStorage.getItem("role");
    let url = "/trucks?search=" + encodeURIComponent(s);

    // Only managers should send branch
    if (role === "manager") url += "&branch=" + encodeURIComponent(sessionStorage.getItem("branch") || "");

    fetch(url)
        .then(r => r.json())
        .then(data => {
            box.innerHTML = "";
            if (!Array.isArray(data) || !data.length) {
                box.innerHTML = "<p>No trucks found.</p>";
                return;
            }

            const roleNow = sessionStorage.getItem("role");
            data.forEach(t => {
                let updateBtn = "";
                let deleteBtn = "";
                if (roleNow === "admin" || (roleNow === "manager" && t.canUpdate)) updateBtn = `<button onclick="updateStatus(${t.id})">Update Status</button>`;
                if (roleNow === "admin") deleteBtn = `<button onclick="deleteTruck(${t.id})">Delete Truck</button>`;

                const reqBtn = roleNow === "user" ? `<button onclick="requestTruck(${t.id}, '${t.plate_no.replace(/'/g, "\\'")}', '${t.model.replace(/'/g, "\\'")}')">Request Truck</button>` : "";

                box.innerHTML += `<div>
                  <b>${t.plate_no}</b><br>
                  Model: ${t.model}<br>
                  Contact: ${t.contact}<br>
                  Status: ${t.status}<br>
                  Branch: ${t.branch}<br>
                  ${updateBtn} ${deleteBtn} ${reqBtn}
                  </div>`;
            });
        })
        .catch(err => console.error("searchTrucks error:", err));
}

// --- RECENT TRUCKS ---
function loadRecentTrucks() {
    const role = sessionStorage.getItem("role");
    const myBranch = sessionStorage.getItem("branch") || "";

    fetch("/trucks/recent")
        .then(r => r.json())
        .then(data => {
            const box = document.getElementById("recentTruckList");
            if (!box) return;
            box.innerHTML = "";

            const roleNow = sessionStorage.getItem("role");

            data.forEach(t => {
                let buttons = "";
                if (roleNow === "admin") buttons = `<button onclick="updateStatus(${t.id})">Update Status</button> <button onclick="deleteTruck(${t.id})">Delete Truck</button>`;
                else if (roleNow === "manager" && t.branch === myBranch) buttons = `<button onclick="updateStatus(${t.id})">Update Status</button>`;

                const reqBtn = roleNow === "user" ? `<button onclick="requestTruck(${t.id}, '${t.plate_no.replace(/'/g, "\\'")}', '${t.model.replace(/'/g, "\\'")}')">Request Truck</button>` : "";

                box.innerHTML += `<div>
                    <b>${t.plate_no}</b><br>
                    Model: ${t.model}<br>
                    Contact: ${t.contact}<br>
                    Status: ${t.status}<br>
                    Branch: ${t.branch}<br>
                    ${buttons} ${reqBtn}
                    </div>`;
            });
        })
        .catch(err => console.error("Error loading recent trucks:", err));
}

function deleteTruck(id) {
    if (!confirm("Are you sure you want to delete this truck?")) return;

    fetch("/deleteTruck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
        .then(r => r.json())
        .then(data => {
            if (data.success) { alert("Truck deleted!"); location.reload(); }
            else alert("Error deleting truck: " + data.error);
        })
        .catch(err => console.error("deleteTruck error:", err));
}

function updateStatus(id) {
    fetch("/updateStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                alert("Truck status updated!");
                const role = sessionStorage.getItem("role");
                if (role === "manager") {
                    if (typeof loadBranchTrucks === "function") loadBranchTrucks();
                    if (typeof loadRecentTrucks === "function") loadRecentTrucks();
                } else {
                    if (typeof loadRecentTrucks === "function") loadRecentTrucks();
                }
            } else {
                alert("Error: " + data.error);
            }
        })
        .catch(err => console.error("updateStatus error:", err));
}

// --- CONTACT ---
function contactAdmin() {
    const msg = {
        name: document.getElementById("cname").value,
        email: document.getElementById("cemail").value,
        message: document.getElementById("cmsg").value
    };

    if (!msg.name || !msg.email || !msg.message) return alert("All fields are required");

    fetch("/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) })
        .then(r => r.json())
        .then(data => { if (data.success) alert("Message sent!"); else alert("Error: " + data.error); })
        .catch(err => console.error("contactAdmin error:", err));
}

function searchContacts() {
    const query = document.getElementById("contactSearch").value.trim();
    const box = document.getElementById("contactList");
    if (!box) return;

    const url = query ? `/contacts/search?query=${encodeURIComponent(query)}` : "/contacts";
    fetch(url)
        .then(r => r.json())
        .then(data => {
            box.innerHTML = data.length ? data.map(msg => `
                <div style="border:1px solid #ccc; padding:10px; margin-bottom:5px;">
                  <b>From:</b> ${msg.name} (${msg.email || "No email"})<br>
                  <b>Message:</b> ${msg.message}
                </div>`).join("") : "<p>No messages found.</p>";
        })
        .catch(err => console.error("searchContacts error:", err));
}

function loadContacts() {
    const box = document.getElementById("contactList");
    if (!box) return;

    fetch("/contacts").then(r => r.json()).then(data => {
        box.innerHTML = data.length ? data.map(msg => `
            <div style="border:1px solid #ccc; padding:10px; margin-bottom:5px;">
              <b>From:</b> ${msg.name} (${msg.email || "No email"})<br>
              <b>Message:</b> ${msg.message}
            </div>`).join("") : "<p>No messages yet.</p>";
    }).catch(err => console.error("loadContacts error:", err));
}

// --- USERS ---
function loadUsers(search = "") {
    fetch("/users?search=" + encodeURIComponent(search)).then(r => r.json()).then(data => {
        const box = document.getElementById("userList");
        if (!box) return;

        box.innerHTML = data.map(u => `
          <div>
            <b>${u.username}</b> (Role: ${u.role})
            <br>
            <button onclick="upgradeUser(${u.id}, 'admin')">Make Admin</button>
            <button onclick="upgradeUser(${u.id}, 'manager')">Make Manager</button>
          </div>`).join("");
    }).catch(err => console.error("loadUsers error:", err));
}

function searchUsers() {
    const s = document.getElementById("userSearch").value.trim();
    if (!s) return alert("Please enter a username to search.");
    loadUsers(s);
}

function upgradeUser(id, newRole) {
    fetch("/users/upgrade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, newRole }) })
        .then(r => r.json())
        .then(data => { if (data.success) { alert("User upgraded!"); loadUsers(); } else alert("Error: " + (data.error || "unknown")); })
        .catch(err => console.error("upgradeUser error:", err));
}

// --- MANAGERS ---
function loadManagers(search = "") {
    fetch("/managers?search=" + encodeURIComponent(search))
        .then(r => r.json())
        .then(data => {
            const box = document.getElementById("managerList");
            if (!box) return;
            box.innerHTML = "";
            data.forEach(m => {
                let personal = {};
                if (m.personal_detail) {
                    try { personal = JSON.parse(m.personal_detail); } catch (err) { /* ignore */ }
                }

                box.innerHTML += `<div class="manager-card">
                    <b>${m.username}</b> (Role: ${m.role || 'manager'})<br>
                    Branch: ${m.branch || "N/A"}<br>
                    Salary: ${m.salary || 0}<br>
                    Joined: ${m.joined || "N/A"}<br>
                    ${personal.full_name ? "Full Name: " + personal.full_name + "<br>" : ""}
                    ${personal.citizen_id ? "Citizen ID: " + personal.citizen_id + "<br>" : ""}
                    ${personal.address ? "Address: " + personal.address + "<br>" : ""}
                    <button onclick="editManager(${m.id})">Edit</button>
                </div>`;
            });
        })
        .catch(err => console.error("loadManagers error:", err));
}

function searchManagers() {
    const s = document.getElementById("managerSearch").value.trim();
    if (!s) return alert("Please enter a username to search.");
    loadManagers(s);
}

function editManager(id) {
    const branch = prompt("Enter new branch:");
    const salary = prompt("Enter new salary:");
    const joined = prompt("Enter new Date of Joining (YYYY-MM-DD):");
    fetch("/managers/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, branch, salary, joined }) })
        .then(r => r.json())
        .then(data => { if (data.success) { alert("Manager updated!"); loadManagers(); } else alert("Error: " + (data.error || "unknown")); })
        .catch(err => console.error("editManager error:", err));
}

// --- MANAGER PAGE ---
if (page === "manager.html") {
    function loadBranchTrucks() {
        const myBranch = sessionStorage.getItem("branch") || "";
        const role = sessionStorage.getItem("role") || "manager";
        const box = document.getElementById("branchTruckList");
        const info = document.getElementById("branchInfo");
        if (!box) return console.error("No branchTruckList container found");

        box.innerHTML = "<p>Loading trucks...</p>";

        fetch("/trucks?branch=" + encodeURIComponent(myBranch))
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data) || !data.length) {
                    box.innerHTML = "<p>No trucks found in your branch.</p>";
                    if (info) info.textContent = `Total trucks you can manage in branch (${myBranch}): 0`;
                    return;
                }

                let count = 0;
                let html = `
                    <table border="1" style="width:100%; border-collapse:collapse;">
                      <thead>
                        <tr>
                          <th>#</th><th>Plate No</th><th>Model</th><th>Contact</th><th>Insurance</th><th>Status</th><th>Branch</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                `;

                data.forEach((t, i) => {
                    let updateBtn = "";
                    let deleteBtn = "";
                    if (role === "admin" || (role === "manager" && t.branch === myBranch)) {
                        updateBtn = `<button onclick="updateStatus(${t.id})">Update Status</button>`;
                        count++;
                    }
                    if (role === "admin") deleteBtn = `<button onclick="deleteTruck(${t.id})">Delete Truck</button>`;

                    html += `<tr>
                        <td>${i + 1}</td>
                        <td>${t.plate_no}</td>
                        <td>${t.model}</td>
                        <td>${t.contact}</td>
                        <td>${t.insurance}</td>
                        <td>${t.status}</td>
                        <td>${t.branch}</td>
                        <td>${updateBtn} ${deleteBtn}</td>
                        </tr>`;
                });

                html += "</tbody></table>";
                box.innerHTML = html;
                if (info) info.textContent = `Total trucks you can manage in branch (${myBranch}): ${count}`;
            })
            .catch(err => {
                console.error("Error loading branch trucks:", err);
                box.innerHTML = "<p>Error loading trucks.</p>";
                if (info) info.textContent = `Total trucks you can manage in branch (${myBranch}): 0`;
            });
    }

    function compareBranches() {
        const box = document.getElementById("branchCompare");
        if (!box) return;

        fetch("/branchSummary")
            .then(r => r.json())
            .then(data => {
                box.innerHTML = Object.entries(data).map(([b, c]) => `${b}: ${c} requests`).join("<br>");
            })
            .catch(err => console.error("compareBranches error:", err));
    }

    function contactAdminManager() {
        const msg = document.getElementById("msg").value;
        if (!msg) return alert("Message cannot be empty");
        fetch("/contactAdmin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, managerName: sessionStorage.getItem("username") || "Manager", managerEmail: sessionStorage.getItem("email") || "" }) })
            .then(r => r.json()).then(data => { if (data.success) { alert("Message sent to Admin!"); document.getElementById("msg").value = ""; } else alert("Error sending message: " + data.error); })
            .catch(err => console.error("contactAdminManager error:", err));
    }

    window.contactAdmin = contactAdminManager;
    window.updateStatus = updateStatus;

    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("branchInfo")) loadBranchTrucks();
        if (document.getElementById("branchCompare")) compareBranches();
        if (document.getElementById("recentTruckList")) loadRecentTrucks();
    });
}


// --- REQUEST TRUCK MODAL LOGIC (User) ---


/**
 * Initiates the truck request process, showing the modal if the user is logged in.
 * @param {number} id 
 * @param {string} plateNo 
 * @param {string} model 
 */
function requestTruck(id, plateNo, model) {
    const username = sessionStorage.getItem("username");
    const role = sessionStorage.getItem("role");

    if (!username || role !== 'user') {
        return alert("Please log in as a User to request a truck.");
    }

    // Check account details status before showing the modal
    fetch(`/account/details?username=${encodeURIComponent(username)}`)
        .then(r => r.json())
        .then(data => {
            const personalDetail = (data && data.personal_detail) || (Array.isArray(data) && data[0] && data[0].personal_detail) || null;
            if (!personalDetail) {
                // If details are missing, redirect the user
                alert("Please complete your personal details before requesting a truck.");
                window.location.href = "account_details.html";
                return;
            }

            // Details are present, show the modal
            showRequestModal(id, plateNo, model);
        })
        .catch(err => {
            console.error("Account check failed:", err);
            alert("Error verifying account details.");
        });
}


/* Displays the request modal, populating it with truck details and resetting state.*/
function showRequestModal(id, plateNo, model) {
    const modal = document.getElementById("requestModal");
    const info = document.getElementById("modalTruckInfo");
    const emailGroup = document.getElementById("requestEmailGroup");
    const submitBtn = document.getElementById("submitRequestBtn");
    const goBackBtn = document.getElementById("goBackBtn");

    if (!modal) {
        console.error("Modal element not found. Please ensure 'requestModal' is in your user.html.");
        return alert("Modal setup error.");
    }

    // 1. Set global state
    _pendingRequest = { truck_id: id, plate_no: plateNo, model: model };

    // 2. Reset modal content to initial state
    info.innerHTML = `You are requesting **Truck ${plateNo} (${model})**.<br>Please enter your contact email:`;
    document.getElementById("requestEmail").value = sessionStorage.getItem("email") || ""; // Pre-fill if email stored
    
    emailGroup.style.display = "block";
    submitBtn.style.display = "inline-block";
    goBackBtn.style.display = "none";
    
    // 3. Display the modal
    modal.style.display = "flex"; // Use flex for centering if CSS is set up
}

/*Closes the modal and resets the global state.*/
function closeModal() {
    const modal = document.getElementById("requestModal");
    if (!modal) return;
    modal.style.display = "none";
    _pendingRequest = { truck_id: null, plate_no: null, model: null };
}

/*Called when user clicks Submit Request inside modal. Sends the request to the server.*/
function submitTruckRequest() {
    const username = sessionStorage.getItem("username");
    if (!username || !_pendingRequest.truck_id) return alert("Missing truck or user info.");

    const email = document.getElementById("requestEmail").value.trim();
    if (!email || !email.includes('@')) return alert("Please enter a valid email address.");
    
    const info = document.getElementById("modalTruckInfo");
    const emailGroup = document.getElementById("requestEmailGroup");
    const submitBtn = document.getElementById("submitRequestBtn");
    const goBackBtn = document.getElementById("goBackBtn");
    
    // Disable submit button during processing
    submitBtn.disabled = true;
    info.textContent = "Processing request, please wait...";

    // Server request (which handles truck_ids update and branch_requests increment)
    fetch("/requestTruck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, truck_id: _pendingRequest.truck_id, email })
    })
        .then(r => r.json())
        .then(resp => {
            submitBtn.disabled = false; // Re-enable if needed for error state
            emailGroup.style.display = "none"; // Hide email input field

            if (resp.success) {
                // SUCCESS STATE
                info.innerHTML = `Request sent successfully!<br>Please wait for further information via your email address: **${resp.email || email}**`;
                submitBtn.style.display = "none";
                goBackBtn.style.display = "inline-block";
                
                // 4) Refresh requested trucks list
                if (typeof loadRequestedTrucks === 'function') loadRequestedTrucks();

            } else if (resp.needDetails) {
                // If details are missing (redundant check, but safe)
                alert("Please edit and save your account details before requesting a truck.");
                closeModal();
                window.location.href = "account_details.html";
                return;
            } else {
                // ERROR STATE
                info.innerHTML = `Request failed: ${resp.error || "Unknown server error"}. Please try again.`;
                submitBtn.style.display = "inline-block";
                goBackBtn.style.display = "inline-block";
                emailGroup.style.display = "block"; // Show email input again
            }

        })
        .catch(err => {
            console.error("submitTruckRequest fetch error:", err);
            submitBtn.disabled = false;
            emailGroup.style.display = "block"; 
            info.innerHTML = "Error submitting request. Check console.";
            goBackBtn.style.display = "inline-block";
        });
}

/* Fetches and displays the list of trucks requested by the current user. */
function loadRequestedTrucks() {
    const username = sessionStorage.getItem("username");
    if (!username) return;

    fetch(`/user/requests?username=${encodeURIComponent(username)}`)
        .then(r => r.json())
        .then(data => {
            const box = document.getElementById("requestedTruckList");
            if (!box) return;

            if (!Array.isArray(data) || !data.length) {
                box.innerHTML = "<p>No requested trucks.</p>";
                return;
            }

            box.innerHTML = data.map(t => `
              <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 5px;">
                <b>Plate No:</b> ${t.plate_no}<br>
                <b>Model:</b> ${t.model}<br>
                <b>Contact:</b> ${t.contact}<br>
                <b>Status:</b> ${t.status}<br>
                <b>Branch:</b> ${t.branch}<br>
              </div>
            `).join("");
        })
        .catch(err => {
            console.error("loadRequestedTrucks error:", err);
            const box = document.getElementById("requestedTruckList");
            if (box) box.innerHTML = "<p>Error loading requested trucks.</p>";
        });
}

// --- STATS ---
function compareBranches() {
    const box = document.getElementById("branchCompare");
    if (!box) return;
    fetch("/branchSummary").then(r => r.json()).then(data => {
        box.innerHTML = Object.entries(data).map(([b, c]) => `${b}: ${c} requests`).join("<br>");
    }).catch(err => console.error("compareBranches error:", err));
}

// --- INIT & ROLE-based loads ---
document.addEventListener("DOMContentLoaded", () => {
    // Load common widgets
    if (document.getElementById("contactList")) {
        loadContacts();
        setInterval(loadContacts, 15000);
    }

    if (window.location.pathname.endsWith("admin.html")) {
        loadUsers();
        loadManagers();
    }

    if (document.getElementById("recentTruckList")) loadRecentTrucks();

    // If on user page, load requested trucks as well
    if (page === "user.html") {
        loadRequestedTrucks(); // NEW FUNCTION CALL
    }

    // Ensure logout button exists on all pages where expected
    const logout = document.getElementById("logoutBtn");
    if (logout) {
        logout.addEventListener("click", () => {
            sessionStorage.clear();
            window.location.href = "index.html";
        });
    }
    
    // Set closeModal to handle the "Go Back" button if the ID exists
    const goBackBtn = document.getElementById("goBackBtn");
    if (goBackBtn) goBackBtn.onclick = closeModal;
});