require('dotenv').config(); // Load environment variables

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
const https = require('https');
const fs = require('fs');
const http = require('http');
const qr = require('qrcode');
const axios = require('axios');

// Read SSL certificate files
const privateKey = fs.readFileSync('/etc/letsencrypt/live/kleats.in/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/kleats.in/fullchain.pem', 'utf8');

const credentials = {
  key: privateKey,
  cert: certificate
};



// Add this near the top of your file, after imports
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Initialize Supabase client using environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
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
  host: "smtp.office365.com",
  port: 587, // 587 is the recommended port for STARTTLS
  secure: false, // true for port 465, false for other ports
  auth: {
    user: process.env.OUTLOOK_USER, // Use environment variable
    pass: process.env.OUTLOOK_PASS // Use environment variable
  }
});

transporter.verify(function (error, success) {
  if (error) {
    console.log('Server connection failed:', error);
  } else {
    console.log('Server is ready to take our messages');
  }
});

// Configure Zoho mail transporter
const zohoTransporter = nodemailer.createTransport({
  host: 'smtp.zoho.in',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: 'orders@kleats.in',
    pass: 'KLeats@glug24',
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false
  },
  debug: true // Enable debug logs
});

// Verify transporter configuration
zohoTransporter.verify(function(error, success) {
  if (error) {
    console.log('Zoho Mail verification error:', error);
  } else {
    console.log('Zoho Mail Server is ready to take our messages');
  }
});



//BuyNow GateWay
app.post('/api/buyNow', async (req, res) => {
  try {
    const { name, phone, email, items, order_time, orderType } = req.body;

    let totalPrice = 0.00;
    let totalQuantity = 0;
    let orderId = uuidv4();

    // Calculate total quantity and base price
    for (const item of items) {
      if (item.quantity > 0) {
        totalQuantity += item.quantity;
        const { data: it, error: userError } = await supabase
          .from('menu')
          .select('item_price,canteenId')
          .eq('item_id', item.item_id)
          .single();

        if (userError || !it) {
          console.log("Error while fetching menu price");
          return res.json({ code: -1, message: 'Error while fetching menu price' });
        }

        let itemPrice = Number(it.item_price);
        // Add GST (5%)
        itemPrice = itemPrice + (itemPrice * 0.05);
        
        const itemTotal = itemPrice * item.quantity;
        totalPrice += itemTotal;

        // Store in database
        const { error } = await supabase
          .from('orders')
          .insert({
            order_id: orderId,
            user_id: Number(phone),
            item_id: item.item_id,
            quantity: item.quantity,
            payment_status: 'Pending',
            name: name,
            datetime: getTime(),
            price: itemTotal,
            canteenId: it.canteenId,
            orderTime: order_time,
            email: email,
            order_type: orderType
          });

        if (error) {
          console.log('Error inserting order:', error);
          return res.json({ code: -1, message: 'Error while placing order.' });
        }
      }
    }

    // Add pickup charge if applicable (₹5 per item)
    const pickupCharge = orderType === 'pickup' ? (5 * totalQuantity) : 0;
    totalPrice += pickupCharge;

    const paymentObj = {
      order_amount: Math.ceil(totalPrice),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: name.split(' ')[0] + "_" + phone,
        customer_phone: phone,
        customer_name: name
      },
      order_meta: {
        return_url: "https://kleats.in/api/order?order_id={order_id}"
      }
    };

    console.log('Final payment object:', paymentObj);

    const response = await fetch("https://api.cashfree.com/pg/orders", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-Id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET,
        'x-api-version': process.env.CASHFREE_API_VERSION
      },
      body: JSON.stringify(paymentObj)
    });

    const data = await response.json();
    console.log('Payment Gateway Response:', data);

    if (data.type) {
      return res.json({ code: -1, message: data.message });
    }
    return res.json({ code: 1, message: 'Success', data: data });

  } catch (err) {
    console.error('Error in buyNow:', err);
    return res.json({ code: -1, message: 'Internal Server Error' });
  }
});



function getTime() {
  const currentDateTime = new Date();

  const year = currentDateTime.getFullYear();
  const month = (currentDateTime.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = currentDateTime.getDate().toString().padStart(2, '0');
  const hours = currentDateTime.getHours().toString().padStart(2, '0');
  const minutes = currentDateTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentDateTime.getSeconds().toString().padStart(2, '0');

  const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  return formattedDateTime;
}


app.get('/api/order', async (req, res) => {
  try {
    const orderId = req.query.order_id;

    // Check if the email has already been sent for this order
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('email_sent, email')
      .eq('order_id', orderId)
      .single();

    if (existingOrderError) {
      console.error("Error checking existing order:", existingOrderError);
      return res.render('error', { message: 'Error processing order' });
    }

    // Fetch order details from Cashfree API
    const response = await fetch('https://api.cashfree.com/pg/orders/' + orderId, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'x-client-Id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET,
        'x-api-version': process.env.CASHFREE_API_VERSION
      }
    });

    const data = await response.json();

    if (data.type) {
      return res.json({ code: -1, message: data.message });
    }

    // Update order status in database
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: data.order_status })
      .eq('order_id', orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      return res.render('failed', {
        username: req.cookies.cookuname || null,
        userid: req.cookies.cookuid || null
      });
    }

    if (data.order_status == 'PAID') {
      let me = [];
      // Fetch order items
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('orders')
        .select('item_id,quantity')
        .eq('order_id', orderId);

      if (orderItemsError) {
        console.error("Error fetching order items:", orderItemsError);
        return res.render('error', { message: 'Error fetching order details' });
      }

      // Fetch menu items for each order item
      for (const item of orderItems) {
        const { data: menuItem, error: menuError } = await supabase
          .from('menu')
          .select('item_name')
          .eq('item_id', item.item_id)
          .single();

        if (!menuError && menuItem) {
          me.push({ item_name: menuItem.item_name, quantity: item.quantity });
        }
      }

      // Send email if not sent already
      if (!existingOrder.email_sent) {
        await sendOrderConfirmationEmail(existingOrder.email, {
          userName: data.customer_details.customer_name,
          phoneNumber: data.customer_details.customer_phone,
          totalPrice: data.order_amount,
          paymentStatus: data.order_status,
          tokenNumber: data.order_id,
          menu: me
        });

        // Update email_sent status
        const { error: emailSentUpdateError } = await supabase
          .from('orders')
          .update({ email_sent: true })
          .eq('order_id', orderId);

        if (emailSentUpdateError) {
          console.error("Error updating email_sent status:", emailSentUpdateError);
        }
      }

      return res.render('confirmation2', {
        order: {
          userName: data.customer_details.customer_name,
          phoneNumber: data.customer_details.customer_phone,
          totalPrice: data.order_amount,
          paymentStatus: data.order_status,
          tokenNumber: data.order_id
        },
        menu: me
      });
    } else {
      return res.render('failed', {
        username: req.cookies.cookuname || null,
        userid: req.cookies.cookuid || null
      });
    }
  } catch (err) {
    console.error("Error processing order:", err);
    return res.render('error', { message: 'Error processing order' });
  }
});


app.get('/api/canteen/:canteenId', async (req, res) => {
  try {
    const canteenId = req.params.canteenId;
    console.log(canteenId);
    //return res.json({code:1});

    const { data: menuItem, error: munuError } = await supabase
      .from('menu')
      .select('*')
      .eq('canteenId', canteenId);

    if (munuError) {
      console.log(munuError);
      return res.json({ code: -1, message: 'Failed to fetch menu Items' });
    }

    // const {data:canteenData,error:canteenError}=await supabase
    // .from('admin')
    // .select('admin_name')
    // .eq('canteenId',canteenId)
    // .single();

    // if(canteenError){
    //   console.log(canteenError);
    //   return res.json({code:-1,message:'Failed to fetch menu Items. Please try again.'});
    // }


    res.render("homepage", {
      items: menuItem || [],
      canteenId: canteenId,
      canteenName: canteenId
    });


  } catch (err) {
    console.log(err);
    return res.json({ code: -1, message: "Internal server." });
  }

});


app.get('/api/canteen2/:canteenId', async (req, res) => {
  try {
    const canteenId = req.params.canteenId;
    console.log(canteenId);
    //return res.json({code:1});

    const { data: menuItem, error: munuError } = await supabase
      .from('menu')
      .select('*')
      .eq('canteenId', canteenId);

    if (munuError) {
      console.log(munuError);
      return res.json({ code: -1, message: 'Failed to fetch menu Items' });
    }

    // const {data:canteenData,error:canteenError}=await supabase
    // .from('admin')
    // .select('admin_name')
    // .eq('canteenId',canteenId)
    // .single();

    // if(canteenError){
    //   console.log(canteenError);
    //   return res.json({code:-1,message:'Failed to fetch menu Items. Please try again.'});
    // }


    res.render("homepage2", {
      items: menuItem || [],
      canteenId: canteenId,
      canteenName: canteenId
    });


  } catch (err) {
    console.log(err);
    return res.json({ code: -1, message: "Internal server." });
  }

});


// Store OTPs (in memory for this example, use a database in production)
const otps = new Map();

//For Admin to remove products.
app.get("/admin_remove_products", async (req, res) => {
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

    // Fetch all menu items
    const { data: menuItems, error: menuError } = await supabase
      .from('menu')
      .select('*')
      .eq('canteenId', admin.admin_name);

    if (menuError) {
      throw menuError;
    }

    res.render("admin_remove_products", {
      username: userName,
      items: menuItems,
      userid: userId
    });

  } catch (error) {
    console.error('Error in /admin_remove_products GET:', error);
    res.status(500).send("An error occurred while loading the remove products page");
  }
});

app.post("/admin_remove_products", async (req, res) => {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  const itemIdToRemove = req.body.item_id;

  if (!itemIdToRemove) {
    return res.status(400).send("No item ID provided for removal");
  }

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

    // Fetch the item to get image name (to delete image file)
    const { data: item, error: itemError } = await supabase
      .from('menu')
      .select('item_img')
      .eq('item_id', itemIdToRemove)
      .single();

    if (itemError) {
      console.error('Error fetching item for removal:', itemError);
      return res.status(500).send("Error fetching item details");
    }

    // Delete the item from the database
    const { error: deleteError } = await supabase
      .from('menu')
      .delete()
      .eq('item_id', itemIdToRemove);

    if (deleteError) {
      console.error('Error deleting item:', deleteError);
      return res.status(500).send("Error deleting the item");
    }

    // Delete the image file from the server
    const imagePath = path.join(__dirname, 'public', 'images', 'dish', item.item_img);
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error('Error deleting image file:', err);
        // Not sending error to user as the item is already deleted from DB
      } else {
        console.log(`Image file ${item.item_img} deleted successfully`);
      }
    });

    console.log(`Item with ID ${itemIdToRemove} removed successfully by admin ${userName}`);
    res.redirect("/admin_remove_products");

  } catch (error) {
    console.error('Error in /admin_remove_products POST:', error);
    res.status(500).send("An error occurred while removing the product");
  }
});


// Route to handle OTP requests
app.post('/request-otp', (req, res) => {
  const { email } = req.body;
  console.log(`Attempting to send OTP to: ${email}`);

  const otp = crypto.randomInt(100000, 999999).toString();
  otps.set(email, otp);
  console.log(`Generated OTP for ${email}: ${otp}`);

  const mailOptions = {
    from: process.env.OUTLOOK_USER, // Use environment variable
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
app.post("/signin", express.json(), async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name, user_password, user_email, user_mobileno')
      .eq('user_email', email);

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const user = users[0];
    if (user.user_password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    res.cookie("cookuid", user.user_id);
    res.cookie("cookuname", user.user_name);
    
    return res.json({ 
      success: true, 
      redirect: '/',
      userName: user.user_name,
      userEmail: user.user_email,
      userPhone: user.user_mobileno
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

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
    canteen_name: req.query.canteen_name || '',
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
  const { email, password } = req.body;
  //console.log('Received sign-in request:', { email, otp }); // Don't log passwords

  // Check if the OTP is correct
  // if (otps.get(email) !== otp) {
  //   console.log('Invalid OTP for:', email);
  //   return res.status(400).json({ success: false, error: 'Invalid OTP' });
  // }

  // Clear the OTP after use
  //otps.delete(email);

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
async function renderIndexPage(req, res) {
  try {
    const viewCount = await incrementAndGetViewCount();
    res.render('index', { title: 'Express', viewCount: viewCount || 'N/A' });
  } catch (error) {
    console.error('Error fetching view count:', error);
    res.render('index', { title: 'Express', viewCount: 'N/A' });
  }
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
    // Check for existing email
    const { data: emailExists, error: emailError } = await supabase
        .from('users')
        .select('user_email')
        .eq('user_email', email);

    if (emailError) throw emailError;
    
    if (emailExists && emailExists.length > 0) {
        return res.status(400).send("Email already registered");
    }

    // Check for existing mobile number
    const { data: mobileExists, error: mobileError } = await supabase
        .from('users')
        .select('user_mobileno')
        .eq('user_mobileno', mobile);

    if (mobileError) throw mobileError;

    if (mobileExists && mobileExists.length > 0) {
        return res.status(400).send("Phone number already registered");
    }

    // Get the next user ID
    const { data: maxIdData, error: maxIdError } = await supabase
        .from('users')
        .select('user_id')
        .order('user_id', { ascending: false })
        .limit(1);

    if (maxIdError) throw maxIdError;

    const newUserId = maxIdData.length > 0 ? maxIdData[0].user_id + 1 : 1;

    // Insert new user
    const { error: insertError } = await supabase
        .from('users')
        .insert([
            {
                user_id: newUserId,
                user_name: name,
                user_address: address,
                user_email: email,
                user_mobileno: mobile,
                user_password: password
            }
        ]);

    if (insertError) throw insertError;

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
      .select('user_id, user_name, user_password')
      .eq('user_email', email)
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }

    if (!data) {
      console.log('No user found for:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (data.user_password !== password) {
      console.log('Invalid password for:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Successful login
    res.cookie("cookuid", data.user_id);
    res.cookie("cookuname", data.user_name);
    console.log('Successful login for:', email);

    // Redirect to the canteen page after successful sign-in
    return res.json({ success: true, redirect: 'https://kleats.in/api/canteen/jashwanth' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred' });
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
      // Retrieve admin_id and admin_name from cookies
      const adminId = req.cookies.cookuid;
      const adminName = req.cookies.cookuname;
      console.log("Retrieved admin_id from cookie:", adminId);
      console.log("Retrieved admin_name from cookie:", adminName);

      if (!adminId || !adminName) {
        console.error("Admin not authenticated.");
        return res.status(401).send("Unauthorized: Admin not authenticated.");
      }

      // Optional: Verify admin details
      const { data: admin, error: adminError } = await supabase
        .from('admin')
        .select('admin_id, admin_name')
        .eq('admin_id', adminId)
        .eq('admin_name', adminName)
        .single();

      if (adminError || !admin) {
        console.error("Invalid admin credentials.");
        return res.status(401).send("Unauthorized: Invalid admin credentials.");
      }

      // Move the uploaded image to the desired directory
      await fimage.mv("public/images/dish/" + fimage_name);
      console.log("File moved successfully");

      // Insert new food item into the 'menu' table with admin_id and canteenId
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
            admin_id: adminId,
            canteenId: adminName, // Changed from canteenid to canteenId
          }
        ]);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log("Food item added successfully by admin ID:", adminId, "and admin name:", adminName);
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
      .eq('canteenId', admin.admin_name)
      .eq('payment_status', 'PAID')
      .order('datetime', { ascending: true });

    if (ordersError) {
      throw ordersError;
    }

    // Convert user_id to string to preserve its value
    const formattedOrders = orders.map(order => ({
      ...order,
      user_id: order.user_id.toString()
    }));


    for (let i = 0; i < formattedOrders.length; i++) {
      const { data: menu, error: menuError } = await supabase
        .from('menu')
        .select('item_name')
        .eq('item_id', formattedOrders[i].item_id)
        .single();
      if (!menuError) {
        formattedOrders[i].item_name = menu.item_name;
      }
      console.log(formattedOrders);
    }

    res.render("admin_view_dispatch_orders", {
      username: userName,
      userid: userId,
      orders: formattedOrders
    });

  } catch (error) {
    console.error('Error in renderViewDispatchOrdersPage:', error);
    res.status(500).send("An error occurred while loading the dispatch orders page");
  }
}

// Add this new route for redirecting /varun to Jashwanth's website
app.get('/varun', (req, res) => {
  res.redirect('https://jashwanth53.pythonanywhere.com/');
});

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
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId);

      if (orderError) throw orderError;

      if (orders && orders.length > 0) {
        for (const order of orders) {
          // Insert into order_dispatch
          const { error: insertError } = await supabase
            .from('order_dispatch')
            .insert({
              order_id: order.order_id,
              user_id: order.user_id.toString(),
              item_id: order.item_id,
              quantity: order.quantity,
              price: order.price,
              datetime: new Date()
            });

          if (insertError) throw insertError;

          // Update order status
          const { error: updateError } = await supabase
            .from('orders')
            .update({ payment_status: 'DISPATCHED' })
            .eq('order_id', orderId);

          if (updateError) throw updateError;
        }
      }
    }

    // Fetch updated orders
    const { data: updatedOrders, error: updatedOrdersError } = await supabase
      .from('orders')
      .select('*')
      .eq('canteenId', admin.admin_name)
      .eq('payment_status', 'PAID')
      .order('datetime', { ascending: true });

    if (updatedOrdersError) throw updatedOrdersError;

    res.json({ success: true, orders: updatedOrders });
  } catch (error) {
    console.error('Error in dispatchOrders:', error);

    // Check if the error is not a unique constraint violation
    if (!error.code || error.code !== '23505') {
      //res.status(500).json({ error: 'An error occurred while dispatching orders' });
    } else {
      // For unique constraint violations, we'll just log it and continue
      console.log('Duplicate entry detected, continuing operation');
      res.json({ success: true, message: 'Orders processed with some duplicates ignored' });
    }
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
      .select('*')
      .eq('canteenId', admin.admin_name);

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
  res.clearCookie('cookuid');
  res.clearCookie('cookuname');
  res.json({ success: true, message: 'Logged out successfully' });
}

/*****************************  Additional Pages ***************************/

// Render Contact Us Page
function renderContactUsPage(req, res) {
  res.render("contact_us");
}

// Render Terms and Conditions Page
function renderTermsConditionsPage(req, res) {
  res.render("terms_conditions");
}

// Render Refund Policy Page
function renderRefundPolicyPage(req, res) {
  res.render("refund_policy");
}

// Handle Contact Form Submission
function handleContactForm(req, res) {
  const { name, email, message } = req.body;
  // Here, you can add logic to store the message in your database or send an email

  console.log(`Contact Form Submission:
    Name: ${name}
    Email: ${email}
    Message: ${message}`);

  // Optionally, send a confirmation email to the user
  const mailOptions = {
    from: 'noreply@kleats.in',
    to: email,
    subject: 'Contact Form Submission Received',
    text: `Hello ${name},\n\nThank you for contacting us. We have received your message and will get back to you shortly.\n\nBest regards,\nKL Eats Team`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending confirmation email:', error);
      // Even if email fails, you might still want to acknowledge the form submission
    } else {
      console.log('Confirmation email sent:', info.response);
    }
  });

  res.render("contact_us", { message: "Your message has been received. We'll get back to you shortly." });
}

// Register the routes
app.get("/contact-us", renderContactUsPage);
app.get("/terms-and-conditions", renderTermsConditionsPage);
app.get("/refund-policy", renderRefundPolicyPage);
app.post("/contact", handleContactForm);

// Add this near your other route handlers:
app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.sendFile(__dirname + '/public/index.html');
});

// Add this near your other route definitions
app.get('/.well-known/acme-challenge/mABqFtgnZNkITm3zkzwYuhUcpjLvvbc18BW-HKIsc38', (req, res) => {
  res.type('text/plain');
  res.send('mABqFtgnZNkITm3zkzwYuhUcpjLvvbc18BW-HKIsc38.vrolay1CN-muJmcR1eJReUWev880xt9vyM-Cnad9dE0');
});

// Add this new route
app.get("/admin_view_orders", async (req, res) => {
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

    // Fetch dispatched orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('canteenId', admin.admin_name)
      .eq('payment_status', 'DISPATCHED')
      .order('datetime', { ascending: false });

    if (ordersError) {
      throw ordersError;
    }

    // Calculate total money
    let totalMoney = 0;
    for (let order of orders) {
      totalMoney += parseFloat(order.price);
    }

    // Fetch item names
    for (let i = 0; i < orders.length; i++) {
      const { data: menu, error: menuError } = await supabase
        .from('menu')
        .select('item_name')
        .eq('item_id', orders[i].item_id)
        .single();

      if (!menuError && menu) {
        orders[i].item_name = menu.item_name;
      }
    }

    res.render("admin_view_orders", {
      username: userName,
      userid: userId,
      orders: orders,
      totalMoney: totalMoney
    });

  } catch (error) {
    console.error('Error in admin_view_orders:', error);
    res.status(500).send("An error occurred while loading the view orders page");
  }
});

async function incrementAndGetViewCount() {
  try {
    const { data, error } = await supabase.rpc('increment_views');

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return null;
  }
}

// Modify the route handler for the index page
app.get("/", renderIndexPage);

// Create an HTTP server that redirects to HTTPS
const httpApp = express();
httpApp.use((req, res) => {
  res.redirect(`https://${req.headers.host}${req.url}`);
});

// Start the HTTP server
http.createServer(httpApp).listen(80, () => {
  console.log('HTTP Server running on port 80');
});

// Start the HTTPS server
https.createServer(credentials, app).listen(443, () => {
  console.log('HTTPS Server running on port 443');
});

// Add this new route
app.get('/member', (req, res) => {
  res.redirect('https://forms.office.com/r/iCRskqXN1W');
});

app.get('/members', (req, res) => {
  res.redirect('https://forms.office.com/r/iCRskqXN1W');
});

// Add this route handler
app.get("/admin_scan_order", renderAdminScanOrderPage);

// Add this function
async function renderAdminScanOrderPage(req, res) {
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

    res.render("admin_scan_order", {
      username: userName,
      userid: userId
    });
  } catch (error) {
    console.error('Error in renderAdminScanOrderPage:', error);
    res.status(500).send("An error occurred while loading the scan order page");
  }
}

// Add this route handler for processing scanned orders
app.post("/process_scanned_order", async (req, res) => {
  const { orderId, newStatus } = req.body;
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

    // Update order status
    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('order_id', orderId)
      .eq('canteenId', admin.admin_name);

    if (error) throw error;

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error in process_scanned_order:', error);
    res.status(500).json({ error: 'An error occurred while updating the order status' });
  }
});

// Add this new route
app.get('/api/order-details/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
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

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('canteenId', admin.admin_name)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error in fetchOrderDetails:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching order details' });
  }
});

async function sendOrderConfirmationEmail(email, orderDetails) {
  const { userName, phoneNumber, totalPrice, paymentStatus, tokenNumber, menu } = orderDetails;

  let menuHtml = menu.map(item => `<li>${item.item_name} x ${item.quantity}</li>`).join('');

  // Generate QR code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tokenNumber)}`;

  const mailOptions = {
    // from: process.env.OUTLOOK_USER,  // Comment out old sender
    from: {  // Use new Zoho Mail sender
      name: 'KL Eats',
      address: 'orders@kleats.in'
    },
    to: email,
    subject: 'Your Order Confirmation',
    html: `
      <h1>Order Confirmation</h1>
      <p>Thank you for your order, ${userName}!</p>
      <p>Order Details:</p>
      <ul>
        <li>Token Number: ${tokenNumber.split('-')[1]}</li>
        <li>Total Price: ₹${totalPrice}</li>
        <li>Payment Status: ${paymentStatus}</li>
        <li>Phone Number: ${phoneNumber}</li>
      </ul>
      <h2>Your Order:</h2>
      <ul>
        ${menuHtml}
      </ul>
      <p>Please show the QR code below when collecting your order:</p>
      <img src="${qrCodeUrl}" alt="Order QR Code" />
    `
  };

  try {
    // await transporter.sendMail(mailOptions);  // Comment out old transporter
    await zohoTransporter.sendMail(mailOptions);  // Use Zoho transporter instead
    console.log('Order confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
}

// Add this new route for SSE
app.get('/admin-orders-stream', async (req, res) => {
  const userName = req.cookies.cookuname;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Function to send updates
  const sendUpdate = async () => {
    try {
      // Fetch dispatched orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('canteenId', userName)
        .eq('payment_status', 'DISPATCHED')
        .order('datetime', { ascending: false });

      if (ordersError) throw ordersError;

      // Calculate total money
      let totalMoney = 0;
      for (let order of orders) {
        totalMoney += parseFloat(order.price);
      }

      // Fetch item names
      for (let i = 0; i < orders.length; i++) {
        const { data: menu, error: menuError } = await supabase
          .from('menu')
          .select('item_name')
          .eq('item_id', orders[i].item_id)
          .single();

        if (!menuError && menu) {
          orders[i].item_name = menu.item_name;
        }
      }

      res.write(`data: ${JSON.stringify({ orders, totalMoney })}\n\n`);
    } catch (error) {
      console.error('Error in SSE update:', error);
    }
  };

  // Initial data send
  await sendUpdate();

  // Set up Supabase realtime subscription
  const channel = supabase.channel('custom-all-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders'
      },
      async (payload) => {
        console.log('Change received:', payload);
        await sendUpdate();
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  // Clean up on client disconnect
  req.on('close', () => {
    channel.unsubscribe();
  });
});

// Modify this helper function
function isBreakfastTime() {
  const now = new Date();
  const hours = now.getHours();
  return hours < 11; // Changed from 11 to 12 (available until noon)
}

// Modify your route handler that renders homepage2
app.get('/homepage2/:canteenName', async (req, res) => {
  try {
    const canteenName = req.params.canteenName;
    const isBreakfast = isBreakfastTime();

    // Fetch menu items
    const { data: items, error } = await supabase
      .from('menu')
      .select('*')
      .eq('canteenId', canteenName)
      .eq('is_paused', false); // Only fetch active items

    if (error) throw error;

    // Filter out breakfast items if after 11 AM
    const filteredItems = items.filter(item => {
      if (item.item_category === 'breakfast') {
        return isBreakfast;
      }
      return true;
    });

    res.render('homepage2', {
      items: filteredItems,
      canteenName: canteenName
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Add this new route to handle toggling item status
app.post('/api/toggle-item-status', async (req, res) => {
  try {
    const { itemId, status } = req.body;
    const userName = req.cookies.cookuname;

    console.log('Received request:', { itemId, status, userName }); // Debug log

    // First verify that this item belongs to the logged-in admin
    const { data: item, error: itemError } = await supabase
      .from('menu')
      .select('canteenId, is_paused')
      .eq('item_id', itemId)
      .single();

    console.log('Database query result:', { item, itemError }); // Debug log

    if (itemError) {
      console.error('Item query error:', itemError);
      return res.json({
        success: false,
        message: 'Error finding item: ' + itemError.message
      });
    }

    if (!item) {
      return res.json({
        success: false,
        message: 'Item not found'
      });
    }

    if (item.canteenId !== userName) {
      return res.json({
        success: false,
        message: `Unauthorized: ${userName} cannot modify items for ${item.canteenId}`
      });
    }

    // Update the item status
    const { data: updateData, error: updateError } = await supabase
      .from('menu')
      .update({ is_paused: status })
      .eq('item_id', itemId)
      .select();

    console.log('Update result:', { updateData, updateError }); // Debug log

    if (updateError) {
      console.error('Update error:', updateError);
      return res.json({
        success: false,
        message: 'Error updating item: ' + updateError.message
      });
    }

    res.json({
      success: true,
      message: 'Item status updated successfully',
      newStatus: status,
      reload: true
    });
  } catch (error) {
    console.error('Error in toggleItemStatus:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred: ' + error.message
    });
  }
});

// Add this near your other route handlers
app.get('/failed', (req, res) => {
    const orderId = req.query.order_id || '';
    const tokenId = orderId.split('-')[1] || ''; // Extract the second part after the hyphen

    res.render('failed', {
        username: req.cookies.cookuname || null,
        userid: req.cookies.cookuid || null,
        tokenId: tokenId
    });
});

// Add this new route handler
app.get("/user-history", async (req, res) => {
  const userId = req.cookies.cookuid;
  const userName = req.cookies.cookuname;
  const page = parseInt(req.query.page) || 1;
  const ordersPerPage = 10;

  try {
    // Verify user and get their mobile number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, user_name, user_mobileno')
      .eq('user_id', userId)
      .eq('user_name', userName)
      .single();

    if (userError || !user) {
      return res.redirect("/signin");
    }

    // Fetch all orders for this user
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.user_mobileno);

    if (allOrdersError) throw allOrdersError;

    // Calculate total spent and prepare monthly data
    let totalSpent = 0;
    const monthlySpending = {};
    
    allOrders.forEach(order => {
      if (order.payment_status === 'PAID' || order.payment_status === 'DISPATCHED') {
        totalSpent += parseFloat(order.price);
        
        // Format date to YYYY-MM
        const orderDate = new Date(order.datetime);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + parseFloat(order.price);
      }
    });

    // Convert monthly spending to arrays for Chart.js
    const sortedMonths = Object.keys(monthlySpending).sort();
    const monthlyData = {
      labels: sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return `${new Date(year, monthNum - 1).toLocaleString('default', { month: 'short' })} ${year}`;
      }),
      values: sortedMonths.map(month => monthlySpending[month]),
    };

    // Calculate average monthly spending
    const average = monthlyData.values.length > 0 
      ? monthlyData.values.reduce((a, b) => a + b, 0) / monthlyData.values.length 
      : 0;

    // Fetch paginated orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.user_mobileno)
      .order('datetime', { ascending: false })
      .range((page - 1) * ordersPerPage, (page * ordersPerPage) - 1);

    if (ordersError) throw ordersError;

    // Fetch item names for each order
    for (let i = 0; i < orders.length; i++) {
      const { data: menu, error: menuError } = await supabase
        .from('menu')
        .select('item_name')
        .eq('item_id', orders[i].item_id)
        .single();

      if (!menuError && menu) {
        orders[i].item_name = menu.item_name;
      }
    }

    res.render("user_history", {
      username: userName,
      userid: userId,
      orders: orders,
      totalSpent: totalSpent.toFixed(2),
      currentPage: page,
      totalPages: Math.ceil(allOrders.length / ordersPerPage),
      hasMore: allOrders.length > page * ordersPerPage,
      monthlyData: JSON.stringify(monthlyData),
      monthlyAverage: average.toFixed(2)
    });

  } catch (error) {
    console.error('Error in user-history:', error);
    res.status(500).send("An error occurred while loading your order history");
  }
});

app.get('/zoho-domain-verification.html', (req, res) => {
  res.send('61338537');
});

// Add this near your other route definitions
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "in.kleats.twa",
      "sha256_cert_fingerprints": ["02:A3:C9:DA:02:84:A9:B5:A6:CA:D5:B4:13:2D:AB:2C:98:20:4D:81:20:95:12:41:5A:4C:7A:E6:D7:36:36:F8"]
    }
  }]);
});

// Add these routes after your other route definitions
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('user_email')
      .eq('user_email', email)
      .single();

    if (error || !user) {
      return res.json({ success: false, message: 'Email not found' });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    otps.set(email, {
      code: otp,
      expiry: Date.now() + 10 * 60 * 1000 // OTP valid for 10 minutes
    });

    // Configure Zoho mail transporter with environment variables
    const zohoTransporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ZOHO_MAIL, // 'orders@kleats.in'
        pass: process.env.ZOHO_APP_PASSWORD // Use the App-Specific Password here
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      debug: true
    });

    // Verify transporter configuration
    zohoTransporter.verify(function(error, success) {
      if (error) {
        console.log('Zoho Mail verification error:', error);
      } else {
        console.log('Zoho Mail Server is ready to take our messages');
      }
    });

    // Send email
    await zohoTransporter.sendMail({
      from: {
        name: 'KL Eats',
        address: process.env.ZOHO_MAIL
      },
      to: email,
      subject: 'Password Reset OTP - KL Eats',
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ success: false, message: 'Failed to send OTP' });
  }
});

app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const storedOTP = otps.get(email);
    
    if (!storedOTP || storedOTP.code !== otp || Date.now() > storedOTP.expiry) {
      return res.json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Update password in database
    const { error } = await supabase
      .from('users')
      .update({ user_password: newPassword })
      .eq('user_email', email);

    if (error) throw error;

    // Clear used OTP
    otps.delete(email);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.json({ success: false, message: 'Failed to reset password' });
  }
});

// Fix the check-duplicate route
app.post('/check-duplicate', async (req, res) => {
    const { email, mobile } = req.body;

    try {
        // Check for existing email
        const { data: emailCheck, error: emailError } = await supabase
            .from('users')
            .select('user_email')
            .eq('user_email', email);

        if (emailError) {
            console.error('Email check error:', emailError);
            return res.json({ 
                success: false, 
                message: 'An error occurred while checking email' 
            });
        }

        if (emailCheck && emailCheck.length > 0) {
            return res.json({ 
                success: false, 
                message: 'This email is already registered' 
            });
        }

        // Check for existing mobile
        const { data: mobileCheck, error: mobileError } = await supabase
            .from('users')
            .select('user_mobileno')
            .eq('user_mobileno', mobile);

        if (mobileError) {
            console.error('Mobile check error:', mobileError);
            return res.json({ 
                success: false, 
                message: 'An error occurred while checking mobile number' 
            });
        }

        if (mobileCheck && mobileCheck.length > 0) {
            return res.json({ 
                success: false, 
                message: 'This mobile number is already registered' 
            });
        }

        // No duplicates found
        res.json({ success: true });

    } catch (error) {
        console.error('Server error:', error);
        res.json({ 
            success: false, 
            message: 'An unexpected error occurred' 
        });
    }
});

module.exports = app;
