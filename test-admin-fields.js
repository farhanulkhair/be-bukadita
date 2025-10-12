// Test script for admin controller with new profile fields
const axios = require("axios");

const BASE_URL = "http://localhost:3000/api/admin";

// Test data with new fields
const testUserData = {
  full_name: "Test User Admin",
  phone: "081234567890",
  email: "testuser@admin.com",
  password: "password123",
  role: "pengguna",
  address: "Jl. Test Admin No. 123",
  profil_url: "https://example.com/profile.jpg",
  date_of_birth: "1990-01-01",
};

async function testCreateUser() {
  try {
    console.log("Testing create user with new fields...");

    // You'll need to get a valid admin token first
    const adminToken = "YOUR_ADMIN_TOKEN_HERE";

    const response = await axios.post(`${BASE_URL}/users`, testUserData, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Create user success:", response.data);
    return response.data.data.id;
  } catch (error) {
    if (error.response) {
      console.log("❌ Create user failed:", error.response.data);
    } else {
      console.log("❌ Network error:", error.message);
    }
    return null;
  }
}

async function testGetAllUsers() {
  try {
    console.log("\nTesting get all users...");

    const adminToken = "YOUR_ADMIN_TOKEN_HERE";

    const response = await axios.get(`${BASE_URL}/users`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    console.log("✅ Get all users success");
    console.log(
      "First user sample:",
      JSON.stringify(response.data.data[0], null, 2)
    );
  } catch (error) {
    if (error.response) {
      console.log("❌ Get users failed:", error.response.data);
    } else {
      console.log("❌ Network error:", error.message);
    }
  }
}

// To run this test:
// 1. Start your server: npm start
// 2. Get admin token from login
// 3. Replace YOUR_ADMIN_TOKEN_HERE with actual token
// 4. Run: node test-admin-fields.js

console.log("Test script created. Please:");
console.log("1. Start server: npm start");
console.log("2. Login as admin to get token");
console.log("3. Replace YOUR_ADMIN_TOKEN_HERE in this file");
console.log("4. Run: node test-admin-fields.js");

module.exports = {
  testCreateUser,
  testGetAllUsers,
};
