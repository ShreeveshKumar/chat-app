const express = require('express');
const http = require('http');
const socketIo = require('socket.io'); // keep same version as in frontend for easy connection (socket.io v4.6.1)
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify transporter setup
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter error:', error);
    } else {
        console.log('Email transporter is ready to send messages.');
    }
});

// Function to send an email
function sendMail(recipient, subject, text) {
    // Email options: from, to, subject, and body text
    const mailOptions = {
        from: process.env.EMAIL_USER, // Sender email
        to: recipient, // Receiver email
        subject: subject, // Email subject
        text: text // Email content
    };

    // Sending email using nodemailer
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error occurred: ' + error.message); // Log error if email fails
        }
        console.log('Email sent: ' + info.response); // Log success message
    });
}

// Create an HTTP server using the express app
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:5500", "http://localhost:3000"], // Allowed origins for requests
        methods: ["GET", "POST"] // Allowed HTTP methods
    }
});

// Variable to track how many users are connected
let usersConnected = 0;

// Event listener for new WebSocket connections
io.on('connection', (socket) => {
    // Increment the count when a new user connects
    usersConnected++;
    console.log('A user connected, total: ' + usersConnected); // Log current user count

    // If this is the only user connected, send them a message
    if (usersConnected === 1) {
        socket.emit('user status', 'You are the only one here. Waiting for others to join...'); // Emit message to the single user
    } else {
        // If more than one user is connected, notify the new user and others in the chat
        socket.broadcast.emit('user status', 'A new user has joined the chat'); // Notify existing users about the new user
        socket.emit('user status', 'Another user is connected'); // Notify the new user that others are in the chat
    }

    // Listen for incoming chat messages from clients
    socket.on('chat message', (msg) => {
        console.log(msg); // Log the received message on the server

        // If only one user is connected, notify them and send an email
        if (usersConnected === 1) {
            socket.emit('chat message', 'You are the only one in the chat. Waiting for others to join...');
            sendMail('email@gmail.com', 'Message', `You received a message: ${msg}`); // Send an email when a message is sent by the user
            return;
        } else {
            // If more than one user is connected, broadcast the message to all users
            io.emit('chat message', msg);
        }
    });

    // Event listener for when a user disconnects
    socket.on('disconnect', () => {
        // Decrement the count when a user disconnects
        usersConnected--;
        console.log('A user disconnected, total: ' + usersConnected); // Log the updated user count

        // If no users are left, notify the last user
        if (usersConnected === 0) {
            io.emit('user status', 'You are the only one left in the chat'); // Notify last user when they leave
        } else {
            // Notify remaining users that someone has left the chat
            io.emit('user status', 'A user has left the chat');
        }
    });
});


// this is for broadcasting to all users in the chat a seperate chat for broadcast to keep track of messages 

socket.on('broadcast', () => {
    for (const userId in users) {
        io.to(userId).emit('chat message', msg); // Send to each connected user
    }
});

const PORT = 8000;

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`); // Log message to indicate the server is running
});
