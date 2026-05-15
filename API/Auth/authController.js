import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "./userSchema.js";
import { config } from "../../config/config.js";
import { createSystemClients } from "../utils/createSystemClients.js";

const JWT_SECRET = config.jwtSecret;

/* ================= SIGN UP ================= */
export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, avatar } = req.body;

    if (!name || !email || !password || !phone)
      return res.status(400).json({ message: "All fields required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      avatar,
    });

    await createSystemClients(user._id);

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, avatar: user.avatar },
    });
  } catch (err) {
    console.error("❌ Signup failed:", err);
    res.status(500).json({ message: "Signup failed" });
  }
};

/* ================= LOGIN ================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "All fields required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // ✅ Ensure system accounts exist (for older users)
    await createSystemClients(user._id).catch(err => console.error("Error creating system clients on login:", err));

    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, avatar: user.avatar },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, avatar },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to Update Account" });
  }
};




export const logout = async (req, res) => {
  try {

  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
}
