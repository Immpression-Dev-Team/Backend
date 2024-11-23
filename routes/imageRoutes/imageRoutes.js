// Importing required modules and utilities
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import fetch from 'node-fetch';
import ImageModel, { IMAGE_CATEGORY } from '../../models/images.js';
import { isUserAuthorized, validatePrice, validateImageLink } from '../../utils/authUtils.js';

// Initialize router
const router = express.Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route: Upload a new image (file or link)
router.post('/images', isUserAuthorized, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user._id;
    const { artistName, name, price, description, category, imageLink } = req.body;

    // Validate input fields
    if (!artistName || !name || !price || !description || !category || (!req.file && !imageLink)) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required, and either an image file or link must be provided',
      });
    }

    if (!validatePrice(price)) {
      return res.status(400).json({ success: false, error: 'Invalid price' });
    }

    // Handle file upload or use provided link
    let finalImageLink = imageLink;
    if (req.file) {
      // Simulate saving file to a service like Cloudinary or S3
      finalImageLink = `https://example.com/uploads/${req.file.originalname}`;
    } else if (!validateImageLink(imageLink) || (await fetch(imageLink)).status !== 200) {
      return res.status(400).json({ success: false, error: 'Invalid or inaccessible image link' });
    }

    const newImage = await ImageModel.create({
      userId,
      artistName,
      name,
      imageLink: finalImageLink,
      price,
      description,
      category,
    });

    res.status(201).json({ success: true, message: 'Image uploaded successfully', image: newImage });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      const errorMsg = Object.values(error.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ success: false, error: errorMsg });
    }
    console.error('Error saving image:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Route: Get all images (optional category filter)
router.get('/images', isUserAuthorized, async (req, res) => {
  try {
    const query = {};
    if (req.query.category) {
      if (!IMAGE_CATEGORY.includes(req.query.category)) {
        return res.status(400).json({ success: false, error: 'Invalid category' });
      }
      query.category = req.query.category;
    }

    const images = await ImageModel.find(query);
    res.status(200).json({ success: true, images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Route: Get a single image by ID
router.get('/images/:id', isUserAuthorized, async (req, res) => {
  try {
    const image = await ImageModel.findById(req.params.id);

    if (!image || image.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    res.status(200).json({ success: true, image });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Route: Update an image
router.put('/images/:id', isUserAuthorized, upload.single('image'), async (req, res) => {
  try {
    const updates = { ...req.body };

    // Handle file upload
    if (req.file) {
      updates.imageLink = `https://example.com/uploads/${req.file.originalname}`;
    }

    if (updates.price && !validatePrice(updates.price)) {
      return res.status(400).json({ success: false, error: 'Invalid price' });
    }

    const image = await ImageModel.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        updates,
        { new: true, runValidators: true }
    );

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found or not authorized' });
    }

    res.status(200).json({ success: true, message: 'Image updated successfully', image });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error updating image:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Route: Delete an image
router.delete('/images/:id', isUserAuthorized, async (req, res) => {
  try {
    const image = await ImageModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found or not authorized' });
    }

    res.status(200).json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Route: Increment view count for an image
router.patch('/images/:id/views', async (req, res) => {
  try {
    const image = await ImageModel.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
    );

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    res.status(200).json({ success: true, message: 'View count incremented', views: image.views });
  } catch (error) {
    console.error('Error incrementing views:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Route: Get view count for an image
router.get('/images/:id/views', async (req, res) => {
  try {
    const image = await ImageModel.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    res.status(200).json({ success: true, views: image.views });
  } catch (error) {
    console.error('Error fetching image views:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Export the router
export default router;
