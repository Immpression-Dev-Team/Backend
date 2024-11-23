import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cloudinary from 'cloudinary';

// Import the user model
import UserModel from '../../models/users.js';

// Import utility functions for authentication
import { setAuthCookies, generateAuthToken, isUserAuthorized } from '../../utils/authUtils.js';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD,
  api_key: process.env.CLOUDINARY_API,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Create a new Express router
const router = express.Router();

// User signup
router.post('/users/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (await UserModel.findOne({ email })) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    const newUser = await UserModel.create({ name, email, password });
    res.status(201).json({ success: true, message: 'Signup successful', user: newUser });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// User login
router.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await UserModel.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const authToken = generateAuthToken(user._id);
    setAuthCookies(res, authToken);
    res.status(200).json({ success: true, token: authToken, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// User logout
router.post('/users/logout', (req, res) => {
  try {
    setAuthCookies(res, '');
    res.status(200).json({ success: true, message: 'User logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Get user profile
router.get('/users/me', isUserAuthorized, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id, 'name email bio artistType profilePictureLink views');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Update user profile
router.put('/users/me', isUserAuthorized, async (req, res) => {
  try {
    const updates = req.body;
    const user = await UserModel.findByIdAndUpdate(req.user._id, updates, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Increment view count
router.patch('/users/me/views', isUserAuthorized, async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(req.user._id, { $inc: { views: 1 } }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, views: user.views });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Delete profile picture
router.delete('/users/me/profile-picture', isUserAuthorized, async (req, res) => {
  const { public_id } = req.body;
  try {
    const result = await cloudinary.v2.api.delete_resources([`artists/${public_id}`], { type: 'upload', resource_type: 'image' });
    if (result.deleted[public_id] === 'deleted') {
      res.json({ success: true, message: 'Profile picture deleted successfully' });
      res.json({ success: true, message: 'Profile picture deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Image not found or already deleted in Cloudinary' });
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, error: 'Failed to delete image' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await UserModel.find({}, 'name email profilePictureLink bio artistType views');
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Export the router
export default router;
