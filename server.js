const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');
const User = require('./models/User');
const Message = require('./models/Message');
const chatRoutes = require('./routes/chat');
const propertyRoutes = require('./routes/property');
const authRoutes = require('./routes/auth');  
const userRoutes = require('./routes/user');
const dealRoutes = require('./routes/deal');
const keyRoutes = require('./routes/keys');
const paymentRoutes = require('./routes/payment');
const Property = require('./models/Property');
const {transporter}= require('./controllers/authController')
 

dotenv.config();


console.log('Environment variables check:', {
  hasJwtSecret: !!process.env.JWT_SECRET,
  jwtSecretLength: process.env.JWT_SECRET?.length,
  nodeEnv: process.env.NODE_ENV,
  allEnvKeys: Object.keys(process.env),
  timestamp: new Date().toISOString(),
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_key_123';
console.log('Using JWT secret:', {
  env:process.env.JWT_SECRET, 
  isDefault: JWT_SECRET === 'your_default_jwt_secret_key_123',
  length: JWT_SECRET.length,
  timestamp: new Date().toISOString(),
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization'],
  },
});

const clients = new Map();
io.use(async (socket, next) => {
  console.log('New Socket.IO connection attempt', {
    socketId: socket.id,
    query: socket.handshake.query,
    timestamp: new Date().toISOString(),
  });

  try {
    const token = socket.handshake.query.token;
    if (!token) {
      console.error('No token provided in Socket.IO connection', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded successfully', {
      userId: decoded.userId,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.error('User not found for Socket.IO connection', {
        userId: decoded.userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    next();
  } catch (jwtError) {
    console.error('JWT verification failed', {
      error: jwtError.message,
      token: token ? token.substring(0, 20) + '...' : 'none',
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
    return next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected via Socket.IO', {
    userId: socket.userId,
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  });


  clients.set(socket.userId, socket);
  console.log('Client map updated', {
    userId: socket.userId,
    totalClients: clients.size,
    timestamp: new Date().toISOString(),
  });


  socket.on('chat', async (data) => {
    try {
      console.log('Received Socket.IO chat message', {
        type: data.type,
        to: data.to,
        propertyId: data.propertyId,
        content: data.content?.substring(0, 50) + '...',
        senderId: socket.userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      if (!data.to || !data.content) {
        console.error('Missing required fields in chat message', {
          to: data.to,
          content: data.content,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
        socket.emit('error', { message: 'Receiver ID and content are required' });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(data.to)) {
        console.error('Invalid receiver ID', {
          receiverId: data.to,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
        socket.emit('error', { message: 'Invalid receiver ID' });
        return;
      }

      if (data.propertyId && !mongoose.Types.ObjectId.isValid(data.propertyId)) {
        console.error('Invalid property ID', {
          propertyId: data.propertyId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
        socket.emit('error', { message: 'Invalid property ID' });
        return;
      }

      const newMessage = new Message({
        senderId: socket.userId,
        receiverId: data.to,
        propertyId: data.propertyId,
        content: data.content,
        read: false,
      });

      console.log('Creating new message', {
        senderId: socket.userId,
        receiverId: data.to,
        propertyId: data.propertyId,
        messageId: newMessage._id,
        timestamp: new Date().toISOString(),
      });

      await newMessage.save();
      await newMessage.populate('senderId', 'email profile');
      await newMessage.populate('receiverId', 'email profile');

      //send email to the user when new message received
      try {
        if (newMessage.receiverId?.email) {
          const senderName = newMessage.senderId?.profile?.name || 'a user';
          const messagePreview = newMessage.content.length > 100
            ? newMessage.content.slice(0, 100) + '...'
            : newMessage.content;
          const mailOptions= {
              from: '"MuluCareer" <yenatcreation@gmail.com>',
              to: newMessage.receiverId.email,
              subject: 'You Have a New Message on Easy Rent',
              text: `Hi, you have received a new message from ${senderName}: ${messagePreview}`,
              html: `
                <h2>New Message Received</h2>
                <p>You have a new message from <strong>${senderName}</strong>:</p>
                <blockquote style="color:#444;border-left:3px solid #ccc;padding-left:10px;">
                  ${messagePreview}
                </blockquote>
                <p><a href="http://localhost:3000/chat">Click here to reply</a></p>
                <p style="font-size:small;color:#999;">This is an automated message from Easy Rent.</p>
              `,
            }
          await transporter.sendMail(mailOptions);
          console.log(`email sent to the user ${newMessage.receiverId.email}, to notify new message!`)
        }
      } catch (error) {
        console.warn(`problem while sending email, ${error}`)
      }

      // Log clients map for debugging
      console.log('Clients map status', {
        receiverId: data.to,
        hasSocket: clients.has(data.to),
        totalClients: clients.size,
        timestamp: new Date().toISOString(),
      });

      const recipientSocket = clients.get(data.to);
      if (recipientSocket && recipientSocket.connected) {
        recipientSocket.emit('chat', { type: 'chat', message: newMessage });
        console.log('Message sent to recipient', {
          recipientId: data.to,
          messageId: newMessage._id,
          socketId: recipientSocket.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log('Recipient not connected', {
          recipientId: data.to,
          messageId: newMessage._id,
          timestamp: new Date().toISOString(),
        });
      }
      socket.emit('chat_sent', { type: 'chat_sent', message: newMessage });
      console.log('Confirmation sent to sender', {
        senderId: socket.userId,
        messageId: newMessage._id,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error processing chat message', {
        error: error.message,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
      socket.emit('error', { message: `Failed to process message: ${error.message}` });
    }
  });

  socket.on('disconnect', () => {
    clients.delete(socket.userId);
    console.log('User disconnected from Socket.IO', {
      userId: socket.userId,
      socketId: socket.id,
      totalClients: clients.size,
      timestamp: new Date().toISOString(),
    });
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/payment', paymentRoutes);

app.use((err, req, res, next) => {
  console.error('Server error:', {
    error: err.message,
    stack: err.stack,
    url: req.url, 
    method: req.method,
    timestamp: new Date().toISOString(),
  });
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gebeya-home-rental')
  .then(() => { 
    console.log('Connected to MongoDB', { timestamp: new Date().toISOString() });
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`, { timestamp: new Date().toISOString() });
      console.log(`Socket.IO server running on http://localhost:${PORT}`, { timestamp: new Date().toISOString() });
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});