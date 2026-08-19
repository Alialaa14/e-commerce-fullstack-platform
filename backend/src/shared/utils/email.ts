import nodemailer from "nodemailer";
import { ENV } from "../../config/env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: ENV.EMAIL,
    pass: ENV.EMAIL_PASSWORD,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string,
) => {
  try {
    await transporter.sendMail({ from: ENV.EMAIL, to, subject, text, html });
  } catch (error) {
    console.log(error);
  }
};