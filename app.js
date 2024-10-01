const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const ejs = require("ejs");
const fileUpload = require("express-fileupload");
const { v4: uuidv4 } = require("uuid");
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const session = require('express-session');

// Add this near the top of your file, after imports
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Initialize Supabase client
const supabase = createClient(
  'https://hsctotymjbxryqdhmkcv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzY3RvdHltamJ4cnlxZGhta2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc1Mjg0MzMsImV4cCI6MjA0MzEwNDQzM30.P6OUTPsQqCmzWorUhOHPQEaM5xJ6zJhagduuNc0j5Ww'
);

// Initialize Express App
const app = express();

// Near the top of your file, after initializing the app:
app.use(express.static('public'));

// Set View Engine and Middleware
app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());
app.use(express.static('public'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up Nodemailer transporter for Mailtrap
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "4a52330b125298",
    pass: "d9495a86708e7d"
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.log('Server connection failed:', error);
  } else {
    console.log('Server is ready to take our messages');
  }
});

// Store OTPs (in memory for this example, use a database in production)
const otps = new Map();

// Route to handle OTP requests
app.post('/request-otp', (req, res) => {
  const { email } = req.body;
  console.log(`Attempting to send OTP to: ${email}`);

  const otp = crypto.randomInt(100000, 999999).toString();
  otps.set(email, otp);
  console.log(`Generated OTP for ${email}: ${otp}`);

  const mailOptions = {
    from: 'noreply@kleats.in',
    to: email,
    subject: 'Your OTP for Sign In',
    text: `Your OTP is: ${otp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ message: 'Failed to send OTP' });
    } else {
      console.log('Email sent successfully. Mailtrap info:', info);
      res.json({ message: 'OTP sent successfully' });
    }
  });
});

/*****************************  User-End Portal ***************************/

// Routes for User Sign-up, Sign-in, Home Page, Cart, Checkout, Order Confirmation, My Orders, and Settings
app.get("/", renderIndexPage);
app.post("/signin", express.json(), signInUser);
app.get("/signin", renderSignInPage);
app.get("/homepage", async (req, res) => {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name')
      .eq('user_id', userId)
      .eq('user_name', userName)
      .single();

    if (userError) {
      console.error('User verification error:', userError);
      return res.render("signin");
    }

    if (!user) {
      console.log('No user found with ID:', userId, 'and name:', userName);
      return res.render("signin");
    }

    const { data: menuItems, error: menuError } = await supabase
      .from('menu')
      .select('*');

    if (menuError) {
      console.error('Error fetching menu items:', menuError);
      return res.status(500).send("Error fetching menu items");
    }

    if (!menuItems || menuItems.length === 0) {
      console.log('No menu items found in the database');
    } else {
      console.log(`Found ${menuItems.length} menu items`);
    }

    res.render("homepage", {
      username: userName,
      userid: userId,
      items: menuItems || [],
    });
  } catch (error) {
    console.error('Unexpected error in homepage route:', error);
    res.status(500).send("An unexpected error occurred");
  }
});
app.get('/cart', async (req, res) => {
  const cart = JSON.parse(req.query.cart || '[]');
  const item_count = parseInt(req.query.item_count || '0');

  console.log('Received cart:', cart); // Add this line for debugging

  const itemDetails = await getItemDetails(cart);

  console.log('Item details:', itemDetails); // Add this line for debugging

  res.render('cart', { 
    items: itemDetails, 
    item_count: item_count,
    username: req.cookies.cookuname,
    userid: req.cookies.cookuid
  });
});
app.post("/checkout", checkout);
app.get("/confirmation", renderConfirmationPage);
app.get("/myorders", renderMyOrdersPage);
app.get("/settings", renderSettingsPage);
app.post("/address", updateAddress);
app.post("/contact", updateContact);
app.post("/password", updatePassword);
app.post("/signin", express.json(), (req, res) => {
  console.log("Received signin request:", req.body);
  signInUser(req, res);
});

// Add these lines near other route definitions
app.get("/signup", renderSignUpPage);
app.post("/signup", async (req, res) => {
  try {
    await signUpUser(req, res);
  } catch (error) {
    console.error('Error in signup route:', error);
    res.status(500).send(`An error occurred during registration: ${error.message}`);
  }
});

/***************************************** Admin End Portal ********************************************/
// Routes for Admin Sign-in, Admin Homepage, Adding Food, Viewing and Dispatching Orders, Changing Price, and Logout
app.get("/admin_signin", renderAdminSignInPage);
app.post("/admin_signin", express.json(), adminSignIn);

async function adminSignIn(req, res) {
  const { email, password, otp } = req.body;
  console.log('Received sign-in request:', { email, otp }); // Don't log passwords

  // Check if the OTP is correct
  if (otps.get(email) !== otp) {
    console.log('Invalid OTP for:', email);
    return res.status(400).json({ success: false, error: 'Invalid OTP' });
  }

  // Clear the OTP after use
  otps.delete(email);

  try {
    const { data, error } = await supabase
      .from('admin')
      .select('admin_id, admin_name, admin_email, admin_password')
      .eq('admin_email', email)
      .single();

    if (error) throw error;

    if (!data || data.admin_password !== password) {
      console.log('Invalid credentials for:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const { admin_id, admin_name } = data;
    res.cookie("cookuid", admin_id);
    res.cookie("cookuname", admin_name);
    console.log('Successful admin login for:', email);
    return res.json({ success: true });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
}

app.get("/adminHomepage", renderAdminHomepage);
app.get("/admin_addFood", renderAddFoodPage);
app.post("/admin_addFood", addFood);
app.get("/admin_view_dispatch_orders", renderViewDispatchOrdersPage);
app.post("/admin_view_dispatch_orders", express.json(), dispatchOrders);
app.get("/admin_change_price", renderChangePricePage);
app.post("/admin_change_price", changePrice);
app.get("/logout", logout);

/***************************** Route Handlers ***************************/

// Index Page
function renderIndexPage(req, res) {
  res.render('index', { title: 'Express' });
}

// User Sign-up
function renderSignUpPage(req, res) {
  res.render("signup");
}

async function signUpUser(req, res) {
  const { name, address, email, mobile, password, confirmPassword } = req.body;

  console.log('Received signup request:', { name, address, email, mobile });

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('user_email')
      .eq('user_email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      throw checkError;
    }

    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    // Get the maximum user_id
    const { data: maxIdData, error: maxIdError } = await supabase
      .from('users')
      .select('user_id')
      .order('user_id', { ascending: false })
      .limit(1);

    if (maxIdError) {
      console.error('Error getting max user_id:', maxIdError);
      throw maxIdError;
    }

    // Generate new user_id
    const newUserId = maxIdData.length > 0 ? maxIdData[0].user_id + 1 : 1;

    // Insert new user
    const { data, error } = await supabase
      .from('users')
      .insert([
        { 
          user_id: newUserId,
          user_name: name,
          user_address: address,
          user_email: email,
          user_mobileno: mobile,
          user_password: password // Note: In a real application, you should hash the password
        }
      ]);

    if (error) {
      console.error('Error inserting new user:', error);
      throw error;
    }

    console.log('User registered successfully:', newUserId);
    res.redirect('/signin');
  } catch (error) {
    console.error('Error in signUpUser:', error);
    res.status(500).send(`An error occurred during registration: ${error.message}`);
  }
}

// User Sign-in

function renderSignInPage(req, res) {
  res.render("signin");
}

async function signInUser(req, res) {
  const { email, password } = req.body;
  console.log('Received sign-in request:', { email }); // Don't log passwords

  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, user_name, user_email, user_password')
      .eq('user_email', email);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log('No user found for:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = data[0]; // Get the first user (should be the only one)

    if (user.user_password !== password) {
      console.log('Invalid password for:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const { user_id, user_name } = user;
    res.cookie("cookuid", user_id);
    res.cookie("cookuname", user_name);
    console.log('Successful login for:', email);
    return res.json({ success: true });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
}

// Render Home Page
async function renderHomePage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name')
      .eq('user_id', userId)
      .eq('user_name', userName)
      .single();

    if (userError || !user) {
      return res.render("signin");
    }

    const { data: menuItems, error: menuError } = await supabase
      .from('menu')
      .select('*');

    if (menuError) throw menuError;

    res.render("homepage", {
      username: userName,
      userid: userId,
      items: menuItems,
    });
  } catch (error) {
    console.error('Error in renderHomePage:', error);
    res.status(500).send("An error occurred while loading the homepage");
  }
}

// Render Cart Page
async function renderCart(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    // Verify user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name')
      .eq('user_id', userId)
      .eq('user_name', userName)
      .single();

    if (userError || !user) {
      return res.render("signin");
    }

    // Here, you need to implement a way to fetch cart items from Supabase
    // For now, I'll assume citemdetails and item_in_cart are global variables
    // that are updated elsewhere in your code

    res.render("cart", {
      username: userName,
      userid: userId,
      items: citemdetails,
      item_count: item_in_cart,
    });

  } catch (error) {
    console.error('Error in renderCart:', error);
    res.status(500).send("An error occurred while loading the cart");
  }
}

// Update Cart
function updateCart(req, res) {
  const cartItems = req.body.cart;
  const uniqueItems = [...new Set(cartItems)];

  // Function to fetch details of items in the cart
  getItemDetails(uniqueItems, uniqueItems.length);

  // Update cart logic if necessary
}

// Function to fetch details of items in the cart
let citems = [];
let citemdetails = [];
let item_in_cart = 0;
async function getItemDetails(cart) {
  const itemDetails = [];
  for (const cartItem of cart) {
    try {
      const { data, error } = await supabase
        .from('menu')
        .select('*')
        .eq('item_id', cartItem.item_id)
        .single();

      if (error) throw error;

      if (data) {
        data.item_img = `/images/dish/${data.item_img}`;
        data.quantity = cartItem.quantity;
        itemDetails.push(data);
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  }
  return itemDetails;
}

// Checkout
async function checkout(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  console.log('Received checkout request:', req.body); // Add this line

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name')
      .eq('user_id', userId)
      .eq('user_name', userName)
      .single();

    if (userError || !user) {
      return res.render("signin");
    }

    const cartData = JSON.parse(req.body.cartData || '[]');
    console.log('Parsed cart data:', cartData); // Add this line

    const currDate = new Date();

    for (const item of cartData) {
      if (item.quantity > 0) {
        const { error } = await supabase
          .from('orders')
          .insert({
            order_id: uuidv4(),
            user_id: userId,
            item_id: item.item_id,
            quantity: item.quantity,
            price: item.price * item.quantity,
            datetime: currDate
          });

        if (error) {
          console.error('Error inserting order:', error); // Add this line
          throw error;
        }
      }
    }

    res.render("confirmation", { username: userName, userid: userId });
  } catch (error) {
    console.error('Error in checkout:', error);
    res.status(500).send("An error occurred during checkout");
  }
}

// Render Confirmation Page
async function renderConfirmationPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name')
      .eq('user_id', userId)
      .eq('user_name', userName)
      .single();

    if (userError || !user) {
      return res.render("signin");
    }

    res.render("confirmation", { username: userName, userid: userId });
  } catch (error) {
    console.error('Error in renderConfirmationPage:', error);
    res.status(500).send("An error occurred while loading the confirmation page");
  }
}

// Render My Orders Page
async function renderMyOrdersPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name, user_address, user_email, user_mobileno')
      .eq('user_id', userId)
      .single();

    if (userError) throw userError;

    if (user) {
      const { data: orders, error: ordersError } = await supabase
        .from('order_dispatch')
        .select(`
          order_id,
          user_id,
          quantity,
          price,
          datetime,
          menu:item_id (item_id, item_name, item_img)
        `)
        .eq('user_id', userId)
        .order('datetime', { ascending: false });

      if (ordersError) throw ordersError;

      res.render("myorders", {
        userDetails: [user],
        items: orders,
        item_count: item_in_cart,
      });
    } else {
      res.render("signin");
    }
  } catch (error) {
    console.error('Error in renderMyOrdersPage:', error);
    res.status(500).send("An error occurred while loading your orders");
  }
}

// Render Settings Page
function renderSettingsPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("settings", {
          username: userName,
          userid: userId,
          item_count: item_in_cart,
        });
      }
    }
  );
}
// Update Address
function updateAddress(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  const address = req.body.address;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "UPDATE users SET user_address = ? WHERE user_id = ?",
          [address, userId],
          function (error, results) {
            if (!error) {
              res.render("settings", {
                username: userName,
                userid: userId,
                item_count: item_in_cart,
              });
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Update Contact
function updateContact(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  const mobileno = req.body.mobileno;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "UPDATE users SET user_mobileno = ? WHERE user_id = ?",
          [mobileno, userId],
          function (error, results) {
            if (!error) {
              res.render("settings", {
                username: userName,
                userid: userId,
                item_count: item_in_cart,
              });
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Update Password
function updatePassword(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  const oldPassword = req.body.old_password;
  const newPassword = req.body.new_password;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ? AND user_password = ?",
    [userId, userName, oldPassword],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "UPDATE users SET user_password = ? WHERE user_id = ?",
          [newPassword, userId],
          function (error, results) {
            if (!error) {
              res.render("settings", {
                username: userName,
                userid: userId,
                item_count: item_in_cart,
              });
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Admin Homepage

async function renderAdminHomepage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    // Verify admin
    const { data: admin, error: adminError } = await supabase
      .from('admin')
      .select('admin_id, admin_name')
      .eq('admin_id', userId)
      .eq('admin_name', userName)
      .single();

    if (adminError || !admin) {
      return res.render("admin_signin");
    }

    // Fetch menu items
    const { data: menuItems, error: menuError } = await supabase
      .from('menu')
      .select('*');

    if (menuError) {
      throw menuError;
    }

    // Fetch orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('datetime', { ascending: false });

    if (ordersError) {
      throw ordersError;
    }

    res.render("adminHomepage", {
      username: userName,
      items: menuItems,
      orders: orders
    });

  } catch (error) {
    console.error('Error in renderAdminHomepage:', error);
    res.status(500).send("An error occurred while loading the admin homepage");
  }
}

// Admin Sign-in

function renderAdminSignInPage(req, res) {
  res.render("admin_signin");
}

// Render Add Food Page
async function renderAddFoodPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    const { data, error } = await supabase
      .from('admin')
      .select('admin_id, admin_name')
      .eq('admin_id', userId)
      .eq('admin_name', userName)
      .single();

    if (error || !data) {
      return res.render("admin_signin");
    }

    res.render("admin_addFood", {
      username: userName,
      userid: userId,
      items: [data], // Wrap in array to maintain consistency with previous code
    });
  } catch (error) {
    console.error('Error in renderAddFoodPage:', error);
    res.status(500).send("An error occurred while loading the add food page");
  }
}

// Add Food
async function addFood(req, res) {
  console.log("addFood function called");
  console.log("Request body:", req.body);
  console.log("Request files:", req.files);

  const {
    FoodName,
    FoodType,
    FoodCategory,
    FoodServing,
    FoodCalories,
    FoodPrice,
    FoodRating,
  } = req.body;

  if (!req.files || Object.keys(req.files).length === 0) {
    console.log("No files were uploaded.");
    return res.status(400).send("No files were uploaded.");
  }

  const fimage = req.files.FoodImg;
  const fimage_name = fimage.name;

  console.log("File details:", fimage);

  if (fimage.mimetype == "image/jpeg" || fimage.mimetype == "image/png") {
    try {
      await fimage.mv("public/images/dish/" + fimage_name);
      console.log("File moved successfully");

      const { data, error } = await supabase
        .from('menu')
        .insert([
          {
            item_name: FoodName,
            item_type: FoodType,
            item_category: FoodCategory,
            item_serving: FoodServing,
            item_calories: FoodCalories,
            item_price: FoodPrice,
            item_rating: FoodRating,
            item_img: fimage_name,
          }
        ]);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log("Food item added successfully");
      res.redirect("/admin_addFood");
    } catch (error) {
      console.error('Error in addFood:', error);
      res.status(500).send("An error occurred while adding food: " + error.message);
    }
  } else {
    console.log("Invalid file type");
    res.status(400).send("Invalid file type. Please upload a JPEG or PNG image.");
  }
}

// Render Admin View and Dispatch Orders Page
async function renderViewDispatchOrdersPage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    // Verify admin
    const { data: admin, error: adminError } = await supabase
      .from('admin')
      .select('admin_id, admin_name')
      .eq('admin_id', userId)
      .eq('admin_name', userName)
      .single();

    if (adminError || !admin) {
      return res.render("admin_signin");
    }

    // Fetch orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('datetime', { ascending: true });

    if (ordersError) {
      throw ordersError;
    }

    res.render("admin_view_dispatch_orders", {
      username: userName,
      userid: userId,
      orders: orders
    });

  } catch (error) {
    console.error('Error in renderViewDispatchOrdersPage:', error);
    res.status(500).send("An error occurred while loading the dispatch orders page");
  }
}

// Dispatch Orders
async function dispatchOrders(req, res) {
  const orderIds = req.body.order_id_s;
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    // Verify admin
    const { data: admin, error: adminError } = await supabase
      .from('admin')
      .select('admin_id, admin_name')
      .eq('admin_id', userId)
      .eq('admin_name', userName)
      .single();

    if (adminError || !admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    for (const orderId of orderIds) {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (orderError) throw orderError;

      if (order) {
        // Insert into order_dispatch
        const { error: insertError } = await supabase
          .from('order_dispatch')
          .insert({
            order_id: order.order_id,
            user_id: order.user_id,
            item_id: order.item_id,
            quantity: order.quantity,
            price: order.price,
            datetime: new Date()
          });

        if (insertError) throw insertError;

        // Delete from orders
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('order_id', orderId);

        if (deleteError) throw deleteError;
      }
    }

    // Fetch updated orders
    const { data: updatedOrders, error: updatedOrdersError } = await supabase
      .from('orders')
      .select('*')
      .order('datetime', { ascending: true });

    if (updatedOrdersError) throw updatedOrdersError;

    res.json({ success: true, orders: updatedOrders });
  } catch (error) {
    console.error('Error in dispatchOrders:', error);
    res.status(500).json({ error: 'An error occurred while dispatching orders' });
  }
}

// Render Admin Change Price Page
async function renderChangePricePage(req, res) {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;

  try {
    const { data: admin, error: adminError } = await supabase
      .from('admin')
      .select('admin_id, admin_name')
      .eq('admin_id', userId)
      .eq('admin_name', userName)
      .single();

    if (adminError || !admin) {
      return res.render("signin");
    }

    const { data: menuItems, error: menuError } = await supabase
      .from('menu')
      .select('*');

    if (menuError) throw menuError;

    res.render("admin_change_price", {
      username: userName,
      items: menuItems,
    });
  } catch (error) {
    console.error('Error in renderChangePricePage:', error);
    res.status(500).send("An error occurred while loading the change price page");
  }
}

// Change Price
async function changePrice(req, res) {
  const item_name = req.body.item_name;
  const new_food_price = req.body.NewFoodPrice;

  try {
    // First, check if the item exists
    const { data: existingItem, error: checkError } = await supabase
      .from('menu')
      .select('item_name')
      .eq('item_name', item_name)
      .single();

    if (checkError) throw checkError;

    if (!existingItem) {
      return res.status(404).send("Item not found");
    }

    // If the item exists, update its price
    const { data, error } = await supabase
      .from('menu')
      .update({ item_price: new_food_price })
      .eq('item_name', item_name);

    if (error) throw error;

    // Redirect to admin homepage after successful update
    res.redirect("/adminHomepage");
  } catch (error) {
    console.error('Error in changePrice:', error);
    res.status(500).send("An error occurred while updating the price");
  }
}

// Logout
function logout(req, res) {
  res.clearCookie();
  return res.redirect("/signin");
}

// Add this near your other route handlers:
app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.sendFile(__dirname + '/public/index.html');
});

// At the end of your file, replace or add this:
const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
