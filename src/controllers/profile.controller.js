const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");
const Follow = require("../models/follow.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const { uploadOnCloud, deleteFromCloud } = require("../utils/cloudinary");

const getProfile = asyncHandler(async (req, res, next) => {
  const username = req.params.username;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  const user = await User.aggregate([
    { $match: { username: username?.toLowerCase().trim(), isVerified: true } },
    {
      $lookup: {
        from: "follows",
        localField: "_id",
        foreignField: "following",
        as: "followers",
      },
    },
    {
      $lookup: {
        from: "follows",
        localField: "_id",
        foreignField: "follower",
        as: "following",
      },
    },
    {
      $addFields: {
        followersCount: { $size: "$followers" },
        followingCount: { $size: "$following" },
        isFollowing: {
          $cond: {
            if: {
              $in: [req.user._id, "$followers.follower"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        followersCount: 1,
        followingCount: 1,
        isFollowing: 1,
        bio: 1,
        gender: 1,
      },
    },
  ]);
  if (!user || user.length === 0) {
    throw new ApiError(404, "User not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user[0], "User fetched successfully"));
});

const followUser = asyncHandler(async (req, res, next) => {
  const { username } = req.body;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  const user = await User.findOne({
    username: username?.toLowerCase().trim(),
    isVerified: true,
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (username === req.user.username) {
    throw new ApiError(400, "You cannot follow yourself");
  }
  const follow = await Follow.findOne({
    follower: req.user._id,
    following: user._id,
  });
  if (follow) {
    throw new ApiError(400, "Already following this user");
  }
  await Follow.create({ follower: req.user._id, following: user._id });
  return res
    .status(201)
    .json(new ApiResponse(201, null, "Started following user"));
});

const unfollowUser = asyncHandler(async (req, res, next) => {
  const { username } = req.body;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  const user = await User.findOne({
    username: username?.toLowerCase().trim(),
    isVerified: true,
  });
  const followingUser = await Follow.findOne({
    follower: req.user._id,
    following: user._id,
  });
  if (!followingUser) {
    throw new ApiError(400, "Not following this user");
  }
  await Follow.findByIdAndDelete(followingUser._id);
  return res.status(201).json(new ApiResponse(201, null, "Unfollowed user"));
});

const updateAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new ApiError(400, "Please upload an image");
  }
  const avatarLocalPath = req.file.path;
  const avatar = await uploadOnCloud(avatarLocalPath);
  if (!avatar) {
    throw new ApiError(500, "Failed to upload avatar");
  }
  const user = await User.findById(req.user?._id);
  if (user.avatar) {
    await deleteFromCloud(user.avatar);
  }
  await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  );
  return res
    .status(201)
    .json(new ApiResponse(201, { avatar: avatar.url }, "Avatar updated"));
});

const updateProfile = asyncHandler(async (req, res, next) => {
  const { fullName, username, bio, gender } = req.body;
  if (!fullName || !username) {
    throw new ApiError(400, "Full name and username are required");
  }
  const existingUser = await User.findOne({
    username: username.toLowerCase().trim(),
  });
  if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
    throw new ApiError(400, "Username already taken");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        username: username.toLowerCase().trim(),
        bio: bio || "",
        gender: gender || "",
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken -verifyCode -verifyCodeExpiry");
  if (!user) {
    throw new ApiError(500, "Failed to update profile");
  }
  return res.status(201).json(new ApiResponse(201, user, "Profile updated"));
});

const usernameAvailable = asyncHandler(async (req, res, next) => {
  const { username } = req.body;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, { available: false }, "Username not available")
      );
  }
  return res
    .status(200)
    .json(new ApiResponse(200, { available: true }, "Username available"));
});

const getFollowers = asyncHandler(async (req, res, next) => {
  const username = req.params.username;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  const user = await User.findOne({
    username: username?.toLowerCase().trim(),
    isVerified: true,
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const followers = await Follow.aggregate([
    { $match: { following: user._id } },
    {
      $lookup: {
        from: "users",
        localField: "follower",
        foreignField: "_id",
        as: "followerDetails",
      },
    },
    {
      $unwind: "$followerDetails",
    },
    {
      $lookup: {
        from: "follows",
        let: { followerId: "$followerDetails._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$follower", req.user._id] },
                  { $eq: ["$following", "$$followerId"] },
                ],
              },
            },
          },
        ],
        as: "isFollowing",
      },
    },
    {
      $addFields: {
        isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
      },
    },
    {
      $project: {
        _id: 0,
        followerId: "$followerDetails._id",
        fullName: "$followerDetails.fullName",
        username: "$followerDetails.username",
        avatar: "$followerDetails.avatar",
        isFollowing: 1,
      },
    },
  ]);
  return res.status(200).json(new ApiResponse(200, followers, "Followers"));
});

const getFollowing = asyncHandler(async (req, res, next) => {
  const username = req.params.username;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  const user = await User.findOne({
    username: username?.toLowerCase().trim(),
    isVerified: true,
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const following = await Follow.aggregate([
    { $match: { follower: user._id } },
    {
      $lookup: {
        from: "users",
        localField: "following",
        foreignField: "_id",
        as: "followingDetails",
      },
    },
    {
      $unwind: "$followingDetails",
    },
    {
      $lookup: {
        from: "follows",
        let: { followingId: "$followingDetails._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$follower", req.user._id] },
                  { $eq: ["$following", "$$followingId"] },
                ],
              },
            },
          },
        ],
        as: "isFollowing",
      },
    },
    {
      $addFields: {
        isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
      },
    },
    {
      $project: {
        _id: 0,
        followingId: "$followingDetails._id",
        fullName: "$followingDetails.fullName",
        username: "$followingDetails.username",
        avatar: "$followingDetails.avatar",
        isFollowing: 1,
      },
    },
  ]);
  return res.status(200).json(new ApiResponse(200, following, "Following"));
});

module.exports = {
  getProfile,
  followUser,
  unfollowUser,
  updateAvatar,
  updateProfile,
  usernameAvailable,
  getFollowers,
  getFollowing,
};
