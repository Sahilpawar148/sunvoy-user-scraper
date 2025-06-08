Hi, I’m Sahil.

This project is my submission for the Full Stack Engineer Challenge from Sunvoy. 
The goal was to reverse engineer a legacy web app that doesn’t provide a public API 
and build a script that can log in, fetch a list of users, and also get details about the 
currently logged-in user—just like the frontend does.



## About the Script

Here’s what the script does:

- Logs into challenge.sunvoy.com using the given demo credentials
- Reuses the session cookie on subsequent runs to avoid logging in every time
- Makes a POST request to the internal users API to fetch all user entries
- Signs a payload using the HMAC secret and calls the settings API to get the current user
- Stores everything in a nicely formatted `users.json` file

Everything is written in TypeScript and uses minimal dependencies—just the
essentials like `node-fetch`, `fs`, `crypto`, and `path`.

---

## How to Run It


1. Clone this repo
2. Install dependencies:
   npm install

Demo Loom Video: https://www.loom.com/share/d91ec67ac26a4969bfb123abfad48a6b?sid=63014839-577e-4e32-ad93-24b006f08240

