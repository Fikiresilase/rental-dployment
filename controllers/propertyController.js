const Property = require('../models/Property');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only images (jpeg, jpg, png, gif) are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const createProperty = async (req, res) => {
  upload.single('images')(req, res, async (err) => {
    if (err) {
      console.error('Multer Error:', err);
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }

    try {
      console.log('Request Body:', req.body);
      console.log('Uploaded File:', req.file);

      if (!req.body.data) {
        console.error('Missing data field in FormData');
        return res.status(400).json({ message: 'Missing data field in FormData' });
      }

      let data;
      try {
        data = JSON.parse(req.body.data);
        console.log('Parsed Data:', data);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        return res.status(400).json({ message: 'Invalid JSON format in data field', error: parseError.message });
      }

      const requiredFields = ['title', 'description', 'type', 'price', 'floors', 'specifications', 'location'];
      const missingFields = requiredFields.filter((field) => !data[field]);
      if (missingFields.length > 0) {
        console.error('Missing fields:', missingFields);
        return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
      }

      if (!data.specifications || !data.specifications.bedrooms || !data.specifications.bathrooms || !data.specifications.area) {
        console.error('Missing specifications fields');
        return res.status(400).json({
          message: 'Missing required specifications: bedrooms, bathrooms, area',
        });
      }

      if (!data.location.address || !data.location.city) {
        console.error('Missing location fields');
        return res.status(400).json({
          message: 'Missing required location fields: address, city',
        });
      }

      const numericFields = [
        { key: 'price', value: data.price },
        { key: 'floors', value: data.floors },
        { key: 'specifications.bedrooms', value: data.specifications.bedrooms },
        { key: 'specifications.bathrooms', value: data.specifications.bathrooms },
        { key: 'specifications.area', value: data.specifications.area },
      ];
      const invalidNumericFields = numericFields.filter(({ key, value }) => isNaN(Number(value)) || Number(value) < 0);
      if (invalidNumericFields.length > 0) {
        console.error('Invalid numeric fields:', invalidNumericFields);
        return res.status(400).json({
          message: `Invalid numeric fields: ${invalidNumericFields.map(f => f.key).join(', ')}`,
        });
      }

      const images = req.file ? [{ url: req.file.path.replace(/\\/g, '/') }] : [];

      const property = new Property({
        ...data,
        images,
        ownerId: req.user._id,
      });

      await property.save();
      console.log('Property Created:', property);
      res.status(201).json(property);
    } catch (error) {
      console.error('Error creating property:', {
        body: req.body,
        file: req.file,
        error: error.message,
      });
      res.status(400).json({ message: 'Error creating property', error: error.message });
    }
  });
};

const getProperties = async (req, res) => {
  try {
    const {
      type,
      minPrice,
      maxPrice,
      location,
      floors,
      page = 1,
      limit = 6,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ownerOnly,
      ownerId,
      status,
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (location) {
      filter['location.city'] = new RegExp(location, 'i');
    }
    if (floors) filter.floors = Number(floors);
    if (ownerOnly === 'true' && req.user) {
      filter.ownerId = req.user._id;
    }
    if (ownerId) {
      console.log(ownerId, 'OWNER ID IS');
      filter.ownerId = ownerId;
    }
    if (status) {
      console.log(ownerId, 'OWNER ID IS');
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const properties = await Property.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate('ownerId', 'email profile');

    const total = await Property.countDocuments(filter);

    res.json({
      properties,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProperties: total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching properties', error: error.message });
  }
};

const getProperty = async (req, res) => {
  console.log('property', 'smkm');
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching property', error: error.message });
  }
};

const updateProperty = [
  upload.array('images', 10),
  async (req, res) => {
    try {
      const property = await Property.findOne({
        _id: req.params.id,
        ownerId: req.user._id,
      });

      if (!property) {
        console.error('Property not found or not owned:', {
          propertyId: req.params.id,
          userId: req.user._id,
        });
        return res.status(404).json({ message: 'Property not found or you are not authorized' });
      }

      console.log('Request Body:', req.body);
      console.log('Uploaded Files:', req.files);

      const data = {};
      const fields = [
        'title', 'description', 'type', 'price', 'floors',
        'location[address]', 'location[city]', 'location[lat]', 'location[lng]',
        'specifications[bedrooms]', 'specifications[bathrooms]', 'specifications[area]', 'specifications[parking]',
        'amenities', 'status'
      ];
      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field.startsWith('location[')) {
            const key = field.slice(9, -1);
            data.location = data.location || {};
            if (key === 'lat' || key === 'lng') {
              data.location.coordinates = data.location.coordinates || {};
              data.location.coordinates[key === 'lat' ? 'latitude' : 'longitude'] = req.body[field];
            } else {
              data.location[key] = req.body[field];
            }
          } else if (field.startsWith('specifications[')) {
            const key = field.slice(14, -1);
            data.specifications = data.specifications || {};
            data.specifications[key] = key === 'parking' ? req.body[field] === 'true' : req.body[field];
          } else if (field === 'amenities') {
            try {
              data.amenities = JSON.parse(req.body[field]);
            } catch (e) {
              data.amenities = req.body[field].split(',').map(item => item.trim());
            }
          } else {
            data[field] = req.body[field];
          }
        }
      });

      console.log('Parsed Data:', data);

      // Validation
      if (data.title && !data.title.trim()) {
        return res.status(400).json({ message: 'Title cannot be empty' });
      }
      if (data.description && !data.description.trim()) {
        return res.status(400).json({ message: 'Description cannot be empty' });
      }
      if (data.type && !['villa', 'condo', 'apartment', 'other'].includes(data.type)) {
        return res.status(400).json({ message: 'Invalid property type' });
      }
      if (data.status && !['available', 'rented', 'pending'].includes(data.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      if (data.location) {
        if (data.location.address && !data.location.address.trim()) {
          return res.status(400).json({ message: 'Address cannot be empty' });
        }
        if (data.location.city && !data.location.city.trim()) {
          return res.status(400).json({ message: 'City cannot be empty' });
        }
        if (data.location.coordinates) {
          if (data.location.coordinates.latitude !== undefined && isNaN(Number(data.location.coordinates.latitude))) {
            return res.status(400).json({ message: 'Invalid latitude' });
          }
          if (data.location.coordinates.longitude !== undefined && isNaN(Number(data.location.coordinates.longitude))) {
            return res.status(400).json({ message: 'Invalid longitude' });
          }
        }
      }
      if (data.specifications) {
        if (data.specifications.bedrooms !== undefined && (isNaN(Number(data.specifications.bedrooms)) || Number(data.specifications.bedrooms) < 0)) {
          return res.status(400).json({ message: 'Invalid bedrooms' });
        }
        if (data.specifications.bathrooms !== undefined && (isNaN(Number(data.specifications.bathrooms)) || Number(data.specifications.bathrooms) < 0)) {
          return res.status(400).json({ message: 'Invalid bathrooms' });
        }
        if (data.specifications.area !== undefined && (isNaN(Number(data.specifications.area)) || Number(data.specifications.area) < 0)) {
          return res.status(400).json({ message: 'Invalid area' });
        }
      }
      if (data.price !== undefined && (isNaN(Number(data.price)) || Number(data.price) < 0)) {
        return res.status(400).json({ message: 'Invalid price' });
      }
      if (data.floors !== undefined && (isNaN(Number(data.floors)) || Number(data.floors) < 1)) {
        return res.status(400).json({ message: 'Invalid floors' });
      }
      if (data.amenities && !Array.isArray(data.amenities)) {
        return res.status(400).json({ message: 'Amenities must be an array' });
      }

      // Build updates object
      const updates = {};
      if (data.title) updates.title = data.title;
      if (data.description) updates.description = data.description;
      if (data.type) updates.type = data.type;
      if (data.price !== undefined) updates.price = Number(data.price);
      if (data.floors !== undefined) updates.floors = Number(data.floors);
      if (data.status) updates.status = data.status;
      if (data.amenities) updates.amenities = data.amenities;

      if (data.location) {
        updates.location = {
          address: data.location.address || property.location.address,
          city: data.location.city || property.location.city,
          state: property.location.state, // Preserve state
          coordinates: {
            latitude: data.location.coordinates?.latitude !== undefined ? Number(data.location.coordinates.latitude) : property.location.coordinates?.latitude,
            longitude: data.location.coordinates?.longitude !== undefined ? Number(data.location.coordinates.longitude) : property.location.coordinates?.longitude
          }
        };
      }

      if (data.specifications) {
        updates.specifications = {
          bedrooms: data.specifications.bedrooms !== undefined ? Number(data.specifications.bedrooms) : property.specifications.bedrooms,
          bathrooms: data.specifications.bathrooms !== undefined ? Number(data.specifications.bathrooms) : property.specifications.bathrooms,
          area: data.specifications.area !== undefined ? Number(data.specifications.area) : property.specifications.area,
          parking: data.specifications.parking !== undefined ? data.specifications.parking : property.specifications.parking
        };
      }

      if (req.files && req.files.length > 0) {
        updates.images = req.files.map((file) => ({
          url: file.path.replace(/\\/g, '/'),
          publicId: file.filename // Note: publicId may need adjustment based on your cloud storage
        }));
      }

      Object.assign(property, updates);
      await property.save();
      console.log('Property Updated:', property);
      res.json(property);
    } catch (error) {
      console.error('Error updating property:', {
        body: req.body,
        files: req.files,
        error: error.message,
      });
      res.status(400).json({ message: 'Error updating property', error: error.message });
    }
  },
];

const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting property', error: error.message });
  }
};

const searchProperties = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const properties = await Property.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(Number(limit))
      .populate('ownerId', 'email profile');

    const total = await Property.countDocuments({ $text: { $search: query } });

    res.json({
      properties,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProperties: total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching properties', error: error.message });
  }
};

module.exports = {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
  searchProperties,
};