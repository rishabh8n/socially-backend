const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { google } = require("googleapis");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../resend/resend");

const register = asyncHandler(async (req, res) => {
  //get user details from client
  const { username, email, password } = req.body;

  //validation
  if (!username || !email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  //check if user already exists
  const existingUser = await User.findOne({
    email,
    isVerified: true,
  });

  if (existingUser) {
    throw new ApiError(400, "User with this email already exists.");
  }

  // with username
  const existingUsername = await User.findOne({
    username,
    isVerified: true,
  });
  if (existingUsername) {
    throw new ApiError(400, "User with this username already exists.");
  }

  // check if user exists but not verified
  const unverifiedUser = await User.findOne({
    username,
    isVerified: false,
  });

  if (unverifiedUser) {
    if (
      unverifiedUser.email !== email &&
      unverifiedUser.verifyCodeExpiry > Date.now()
    ) {
      throw new ApiError(400, "User with this username already exists.");
    } else if (
      unverifiedUser.email !== email &&
      unverifiedUser.verifyCodeExpiry < Date.now()
    ) {
      await unverifiedUser.deleteOne();
    }
  }

  // TODO: handle unverified users
  const unverifiedExistingUser = await User.findOne({
    email,
  });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 30 * 60 * 1000);

  if (unverifiedExistingUser) {
    unverifiedExistingUser.username = username;
    unverifiedExistingUser.password = password;
    unverifiedExistingUser.verifyCode = code;
    unverifiedExistingUser.verifyCodeExpiry = expiry;
    await unverifiedExistingUser.save();
  } else {
    // create new user
    const user = await User.create({
      username: username,
      email,
      password,
      isVerified: false,
      verifyCode: code,
      verifyCodeExpiry: expiry,
    });
  }
  // check if user is created
  const createdUser = await User.findOne({ email }).select(
    "-password -refreshToken -verifyCode -verifyCodeExpiry"
  );
  if (!createdUser) {
    throw new ApiError(500, "User not created");
  }

  // TODO: send verification email
  await sendVerificationEmail(email, username, code);

  // return response
  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        createdUser,
        "User registered successfully. Please verify your email"
      )
    );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    throw new ApiError(400, "Email and code are required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "User already verified");
  }

  if (user.verifyCode !== code) {
    throw new ApiError(400, "Invalid verification code");
  }
  if (user.verifyCodeExpiry < Date.now()) {
    throw new ApiError(400, "Verification code expired");
  }
  user.isVerified = true;
  user.verifyCode = undefined;
  user.verifyCodeExpiry = undefined;

  // generate tokens
  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -verifyCode -verifyCodeExpiry"
  );

  //cookie options
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  // return response
  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Verification successful"
      )
    );
});

const resendEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, "User does not exist. Please register.");
  }
  if (user.isVerified) {
    throw new ApiError(400, "User is already verified");
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 30 * 60 * 1000);
  user.verifyCode = code;
  user.verifyCodeExpiry = expiry;
  await user.save({ validateBeforeSave: false });
  await sendVerificationEmail(user.email, user.username, code);
  res
    .status(201)
    .json(new ApiResponse(201, {}, "Verification email sent successfully."));
});

const login = asyncHandler(async (req, res) => {
  // get user details from client
  const { email, password } = req.body;

  // validation
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, "Invalid email");
  }

  // check if password field exists
  if (!user.password) {
    throw new ApiError(401, "Please login with Google");
  }

  // check if password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Incorrect password");
  }

  // generate tokens
  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -verifyCode -verifyCodeExpiry"
  );

  //cookie options
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  // return response
  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Login successful"
      )
    );
});

const googleLogin = asyncHandler(async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "postmessage"
    );
    const { code } = req.query;
    const googleResponse = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(googleResponse.tokens);
    const url = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token="${googleResponse.tokens.access_token}"`;
    const userResponse = await axios.get(url);
    const { email, name, picture } = userResponse.data;
    const user = await User.findOne({ email });
    if (!user) {
      const newUser = await User.create({
        fullName: name,
        username: email,
        email: email,
        avatar: picture,
        isVerified: true,
      });
    }
    const createdUser = await User.findOne({ email });
    const accessToken = await createdUser.generateAccessToken();
    const refreshToken = await createdUser.generateRefreshToken();
    createdUser.refreshToken = refreshToken;
    await createdUser.save({ validateBeforeSave: false });

    const loggedInUser = await User.findById(createdUser._id).select(
      "-password -refreshToken"
    );

    //cookie options
    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    // return response
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { user: loggedInUser, accessToken, refreshToken },
          "Login successful"
        )
      );
  } catch (error) {
    throw new ApiError(500, "Google login failed");
  }
});

const logout = asyncHandler(async (req, res) => {
  const userid = req.user._id;

  const user = await User.findByIdAndUpdate(
    userid,
    { refreshToken: undefined },
    { new: true }
  );

  // cookie options
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  // return response
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Logout successful"));
});

const refreshTokens = asyncHandler(async (req, res) => {
  try {
    const token =
      req.cookies.refreshToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new ApiError(400, "No refresh token provided");
    }
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) {
      throw new ApiError(400, "Invalid refresh token");
    }
    if (user.refreshToken !== token) {
      throw new ApiError(400, "Invalid refresh token");
    }
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    //cookie options
    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    //response
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Tokens refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(400, error?.message || "Invalid refresh token");
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, "User not found");
  }
  if (!user.isVerified) {
    throw new ApiError(400, "User is not verified, sign up again");
  }
  if (!user.password) {
    throw new ApiError(400, "User signed up with Google, sign in with google.");
  }
  const token = await user.generatePasswordResetToken();
  const resetLink = `${process.env.CLIENT_URL}/auth/reset-password/${token}`;
  user.passwordResetToken = token;
  await user.save({ validateBeforeSave: false });
  sendPasswordResetEmail(user.email, user.username, resetLink);
  res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset email sent successfully"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!token || !password) {
    throw new ApiError(400, "Token and password are required");
  }
  const decoded = jwt.verify(token, process.env.PASSWORD_RESET_TOKEN_SECRET);
  if (!decoded) {
    throw new ApiError(400, "Invalid token");
  }
  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(400, "Invalid token");
  }
  if (user.passwordResetToken !== token) {
    throw new ApiError(400, "Invalid token");
  }
  user.password = password;
  user.passwordResetToken = undefined;
  await user.save();
  res.status(200).json(new ApiResponse(200, {}, "Password reset successful"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User details fetched successfully"));
});

module.exports = {
  register,
  login,
  googleLogin,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  verifyEmail,
  resendEmail,
};
