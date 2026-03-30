import fetch from "node-fetch";

const response = await fetch("http://localhost:4000/api/email/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "test@example.com",
    subject: "Test",
    html: "<p>Test</p>"
  })
});

const data = await response.json();
console.log("Response status:", response.status);
console.log("Response data:", data);
