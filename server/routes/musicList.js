const express = require('express')
const router = express.Router()
// middleware that is specific to this router
router.use((req, res, next) => {
  console.log('songs sent')
  next();
})

// define the home page route
router.get('/', (req, res) => {
  try {
    console.log("entre al endpoint");
    res.json([
      {
      title: 'omega sheron',
      duration: 456,
      thumb: 'sdsdasd'
      },
      {
        title: 'omega sheron',
        duration: 456,
        thumb: 'sdsdasd'
      }
    ]);
  } catch (error) {
    console.log(error);
  }
  
});

module.exports = router;