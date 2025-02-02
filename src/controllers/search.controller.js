const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

const searchUsers = asyncHandler(async (req, res, next) => {
  const { query } = req.body;
  if (!query) {
    throw new ApiError(400, "Query is required");
  }
  const users = await User.aggregate([
    {
      $match: {
        $and: [
          {
            $or: [
              { fullName: { $regex: query, $options: "i" } },
              { username: { $regex: query, $options: "i" } },
            ],
          },
          { isVerified: true },
          { _id: { $ne: req.user._id } },
        ],
      },
    },
    {
      $lookup: {
        from: "follows",
        let: { followerId: "$_id" },
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
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
      },
    },
  ]);
  res.status(200).json(new ApiResponse(200, { users }));
});
const searchPosts = asyncHandler(async (req, res, next) => {});

module.exports = { searchUsers, searchPosts };
