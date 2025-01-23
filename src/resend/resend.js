const { Resend } = require("resend");
const ApiError = require("../utils/ApiError");

const resend = new Resend(process.env.RESEND_API_KEY);

const verificationTemplate = ({ username, verifyCode }) => {
  return `
    <div style="background-color:#fff;padding:20px;text-align:center;border-radius:5px;">
    <h1>Welcome to Socially</h1>
    <h2>Hello ${username}</h2>
    <p>We've received a sign up request for your account. Please enter the following code to verify your email address</p>
    <div style="background-color:#f4f4f4;padding:10px;border-radius:5px;flex-basis:100%;">${verifyCode}</div>
    </div>
    `;
};

const resetPasswordTemplate = (username, link) => {
  return `
    <div style="background-color:#fff;padding:20px;text-align:center;border-radius:5px;">
    <h1>Reset your password</h1>
    <h2>Hello ${username}</h2>
    <p>We've received a password reset request for your account. Please enter the following code to reset your password</p>
    <a href=${link} style="background-color:#000;color:#fff;padding:10px;border-radius:5px;text-decoration:none;">
    Reset Password</a>
    </div>
    `;
};

const sendVerificationEmail = async (email, username, verifyCode) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Socially <noreply@mails.flyingermany.site>",
      to: email,
      subject: "Verify your email",
      html: verificationTemplate({ username, verifyCode }),
    });
    if (error) {
      console.log(error);
      console.log("Error sending verification email");
      throw new ApiError(500, error.message);
    }
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Error sending verification email"
    );
  }
};

const sendPasswordResetEmail = async (email, username, resetLink) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Socially <noreply@mails.flyingermany.site>",
      to: email,
      subject: "Reset your password",
      html: resetPasswordTemplate(username, resetLink),
    });
    if (error) {
      console.log(error);
      console.log("Error sending password reset email");
      throw new ApiError(500, error.message);
    }
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Error sending password reset email"
    );
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
