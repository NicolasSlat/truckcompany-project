const personal_detail = JSON.stringify({
    full_name: document.getElementById("fullName").value,
    citizen_id: document.getElementById("citizenId").value,
    address: document.getElementById("address").value
});

// Load existing details when page loads
window.onload = function() {
    const username = sessionStorage.getItem("username"); // store this at login
    if (!username) return alert("Not logged in!");

    fetch("/account/details?username=" + username)
        .then(r => r.json())
        .then(data => {
            if (data.personal_detail) {
                const d = JSON.parse(data.personal_detail);
                document.getElementById("fullName").value = d.full_name || "";
                document.getElementById("citizenId").value = d.citizen_id || "";
                document.getElementById("address").value = d.address || "";
            }
        })
        .catch(err => console.error(err));
}

// Save details
function saveDetails() {
    const username = sessionStorage.getItem("username");
    if (!username) return alert("Not logged in!");

    const personal_detail = JSON.stringify({
        full_name: document.getElementById("fullName").value,
        citizen_id: document.getElementById("citizenId").value,
        address: document.getElementById("address").value
    });

    fetch("/account/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, personal_detail })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) alert("Details saved!");
        else alert("Error: " + data.error);
    })
    .catch(err => console.error(err));
}
