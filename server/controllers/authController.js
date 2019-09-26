const userContactPreferenceRepository = require("../repositories")
  .UserContactPreferenceRepository;
const userRepository = require("../repositories").UserRepository;
const volunteerRepository = require("../repositories").VolunteerRepository;
const adminRepository = require("../repositories").AdminRepository;
const moment = require("moment");
const config = require("../config/config.js");
const jwt = require("jsonwebtoken");
const invitationTokenRepository = require("../repositories").InvitationTokenRepository;
const {EmailClient, emailClientTypes} = require("../utils/email");
const {isSecure, hashedPassword, validatePassword} = require("../utils/password");
const {PhoneNumberFormat: PNF, PhoneNumberUtil} = require('google-libphonenumber');
const crypto = require("crypto");
const phoneUtil = PhoneNumberUtil.getInstance();

let AuthController = function (
  userRepository,
  volunteerRepository,
  adminRepository,
  invitationTokenRepository
) {
    this.registerUser = function (req, res) {
        if (!req.body.token) {
            res.status(400).json({message: "Token not present"});
            return;
        }
        invitationTokenRepository.getByToken(req.body.token)
            .then(result => {
                if (!result) {
                    res.status(400).json({message: "Invalid token"});
                    return;
                }
                if (result.email !== req.body.email) {
                    res.status(400).json({message: "Please use the email that received the invitation."});
                    return;
                }
                if (moment.tz('Europe/London').isAfter(result.expiry)) {
                    res.status(400).json({
                        message: "Token has expired. " +
                            "Please request another invite from an admin."
                    });
                    return;
                }
                return userRepository.getByEmail(req.body.email)
                    .then(user => {
                        if (user) {
                            res.status(400).json({message: "An account with that email already exists"});
                        } else {
                            if (!isSecure(req.body.password)) {
                                res.status(400).json({
                                    message: "Password must be at least 8 characters, contain at least one uppercase letter, " +
                                        "one lowercase letter and one number/special character"
                                });
                            } else {
                                let hash = hashedPassword(req.body.password);
                                const number = phoneUtil.parse(req.body.telephone, 'GB');
                                if (!phoneUtil.isValidNumber(number)) {
                                    res
                                        .status(400)
                                        .json({message: "Invalid UK phone number"});
                                } else {
                                    const formattedNumber = phoneUtil.format(number, PNF.E164);
                                    return invitationTokenRepository.removeByToken(req.body.token)
                                        .then(() => userRepository.add(req.body, hash, formattedNumber, result.isAdmin));
                                }
                            }
                        }
                    });
            })
            .then(async user => {
                // Add user to volunteer or admin table
                if (!user.isAdmin) {
                    await volunteerRepository.add({userId: user.id});
                } else {
                    await adminRepository.add({userId: user.id});
                }
                return user;
            })
            .then(async user => {
                // Create entry for user's contact preferences
                await userContactPreferenceRepository.add(user.id, {
                    email: false,
                    text: false
                });
                return user;
            })
            .then(user =>

        res.status(201).json({
          message: "Successful! User created",
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            passwordRetries: user.passwordRetries,
            email: user.email,
            isAdmin: user.isAdmin
          }
        })
      )
      .catch(error => res.status(500).json({message: error}));
  };

  this.inviteAdmin = function (req, res) {
    if (req.body.adminKey !== process.env.ADMIN_KEY) {
      res.status(401).json({message: "Not authenticated"});
      return;
    }
    if (!req.body.email) {
      res.status(400).json({message: "No email has been specified"});
    }
    userRepository.getByEmail(req.body.email)
      .then(user => {
        if (user) {
          res.status(400).json({message: "User already has an account"});
          return;
        }
        return invitationTokenRepository.getByEmail(req.body.email);
      })
      .then(invitation => {
        if (invitation && moment().isBefore(invitation.expires)) {
          res.status(400).json({message: "Volunteer with that email has already been invited!"});
          return;
        }
        const token = crypto.randomBytes(16).toString('hex');
        const expires = moment().add(1, 'days').format();
        return invitationTokenRepository.add(req.body.email, token, expires, true)
          .then(() => {
            const emailClient = new EmailClient(emailClientTypes.NOREPLY);
            return emailClient.send(req.body.email,
              "Invitation to City Harvest",
              `Hello from Mobilise,
You have been invited to join City Harvest's Mobilise application.
Please click the following link to begin creating your account on Mobilise.

${process.env.WEB_URL}/signup?token=${token}

This link will expire in 24 hours.`);
          })
      })
      .then(() => res.status(200).json({message: "Success! Invitation has been sent."}))
      .catch(err => res.status(500).json({message: err}));
  };

  this.loginUser = function (req, res) {
    let lastLogin;
    let loggedInUser;
    userRepository
      .getByEmail(req.body.email)
      .then(user => {
        loggedInUser = user;
        if (user) {
          const currentDate = moment();
          if (!user.unlockDate || currentDate.isAfter(user.unlockDate)) {
            if (user.passwordRetries > 0) {
              if (validatePassword(req.body.password, user.password)) {
                return user;
              }
              const newPasswordRetries = user.passwordRetries - 1;
              return userRepository.update(user, {
                passwordRetries: newPasswordRetries
              })
                .then(() => {res.status(400).json({message: "Invalid Username/Password. Please try again."})});
            }
            if (user.passwordRetries === 0) {
              const unlockDate = moment().add(10, 'minutes').format();
              return userRepository.update(user, {
                unlockDate: unlockDate
              })
                .then(() => {
                  const emailClient = new EmailClient(emailClientTypes.NOREPLY);
                  return emailClient.send(req.body.email,
                    "Incorrect Password Limit Reached",
                    `Hello from Mobilise,
We've noticed that someone tried to log into your account with the wrong password more times than we normally allow.
We're just doing our best to keep your account and personal details secure. We've temporarily locked your account out for 10 minutes.

If this was you, maybe you forgot your password and would like to reset it? 
You can do so here:

${process.env.WEB_URL}/forgot-password

If this wasn't you please send us an email at hello@mobilise.xyz so we can keep an eye on anyone trying to access your account that's not you.
`)
                  }
                )
                .then(() => {res.status(400).json({message: "Incorrect Login details entered too many times. If this email is registered, we have sent instructions to access your account."})});
            }
          }
          // TODO: Sort out res stuff here:
          // res.status(400).json({message: "Incorrect Login details entered too many times. If this email is registered, we have sent instructions to access your account."})
        }
      })
      .then(user => {
        lastLogin = user.lastLogin;
        const currentDate = moment();
        return userRepository.update(user, {
          lastLogin: currentDate
        });
      })
      .then(() => {
        res.status(200).json({
          message: "Successful login!",
          user: {
            uid: loggedInUser.id,
            isAdmin: loggedInUser.isAdmin,
            lastLogin: lastLogin,
            token: generateToken(loggedInUser)
          }
        });
      })
      .catch(() => res.status(500).send("An error occurred"));
  };
};

module.exports = new AuthController(
  userRepository,
  volunteerRepository,
  adminRepository,
  invitationTokenRepository
);

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id
    },
    config["jwt-secret"],
    {expiresIn: '24h'}
  );
}