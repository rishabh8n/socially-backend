const { Router } = require("express");
const verifyJWT = require("../middlewares/auth.middleware");
const {
  register,
  login,
  refreshTokens,
  logout,
  resetPassword,
  changePassword,
  getCurrentUser,
  googleLogin,
  verifyEmail,
  resendEmail,
} = require("../controllers/auth.controller");

const router = Router();

router.route("/register").post(register);
router.route("/verify-email").post(verifyEmail);
router.route("/login").post(login);
router.route("/google").get(googleLogin);
router.route("/refresh-token").post(refreshTokens);
router.route("/logout").post(verifyJWT, logout);
router.route("/password-reset").post(resetPassword);
router.route("/password-reset/:token").post(resetPassword);
router.route("/change-password").post(changePassword);
router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/resend-email").post(resendEmail);

module.exports = router;
