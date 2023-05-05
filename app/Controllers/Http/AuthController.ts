import Mail from "@ioc:Adonis/Addons/Mail";
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Otp from "App/Models/Otp";
import Profile from "App/Models/Profile";
import User from "App/Models/User";
import InputOtpConfirmationValidator from "App/Validators/InputOtpConfirmationValidator";
import InputProfileValidator from "App/Validators/InputProfileValidator";
import LoginValidator from "App/Validators/LoginValidator";
import RegisterValidator from "App/Validators/RegisterValidator";

export default class AuthController {
  public async register({ request, response }: HttpContextContract) {
    const payload = await request.validate(RegisterValidator);

    let arrUrl = request.url().split("/");
    const role = arrUrl[arrUrl.length - 1];

    try {
      const user = await User.create({
        nama: payload.nama,
        email: payload.email,
        password: payload.password,
        role,
      });

      let otp = 0;

      while (otp < 100000) {
        otp = Math.ceil(Math.random() * 1000000);
      }

      if (user) {
        await Otp.create({ otp, userId: user.id });
      }

      await Mail.sendLater((message) => {
        message
          .from("perpus@mail.co")
          .to(payload.email)
          .subject("Welcome Onboard!")
          .htmlView("emails/otp_verification", { otp });
      });

      return response.ok({
        message: "registrasi berhasil, silakan verifikasi email anda",
        data: { nama: payload.nama, email: payload.email, role, otp },
        note: "pada project kali ini otp juga dikirim ke response supaya user dapat melakukan verifikasi otp, karena send otp ke email baru bisa dilakukan di sanbox mailtrap",
      });
    } catch (error) {
      return response.badGateway({
        message: "register gagal",
        errors: error,
      });
    }
  }

  public async login({ request, response, auth }: HttpContextContract) {
    const payload = await request.validate(LoginValidator);

    try {
      let token = await auth
        .use("api")
        .attempt(payload.email, payload.password, { expiresIn: "7 days" });
      return response.ok({
        message: "berhasil login",
        data: token,
      });
    } catch (error) {
      return response.unauthorized({
        message: "password salah",
        errors: error,
      });
    }
  }

  public async logout({ auth, response }) {
    await auth.use("api").revoke();
    return response.ok({
      message: "berhasil logout",
    });
  }

  public async otpConfirmation({ request, response }: HttpContextContract) {
    const payload = await request.validate(InputOtpConfirmationValidator);

    try {
      const user = await User.findBy("email", payload.email);
      const otp = await Otp.findBy("user_id", user?.id);

      if (!(user && otp)) {
        return response.badGateway({
          message: "gagal verifikasi akun",
        });
      }

      if (otp.otp === payload.otp) {
        user.isVerified = true;
        user.save();
        return response.ok({
          message: "berhasil verifikasi akun",
        });
      } else {
        return response.badRequest({
          message: "otp yang dimasukan salah",
        });
      }
    } catch (error) {
      return response.badGateway({
        message: "gagal verifikasi akun",
        errors: error,
      });
    }
  }

  public async profile({ request, response, auth }: HttpContextContract) {
    if (!auth.user) {
      return response.unauthorized({
        message: "login diperlukan untuk mengubah profile",
      });
    }
    const payload = await request.validate(InputProfileValidator);

    try {
      const searchPayload = { userId: auth.user.id };
      await Profile.updateOrCreate(searchPayload, payload);

      return response.ok({
        message: "berhasil mengubah data profile",
      });
    } catch (error) {
      return response.badGateway({
        message: "gagal mengubah data profile",
        errors: error,
      });
    }
  }
}
