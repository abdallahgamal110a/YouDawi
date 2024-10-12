const Patient = require('../models/patientModel')
const asyncHandler = require('../middlewares/asyncHandler')
const httpStatusText = require('../utils/httpStatusText')
const appError = require('../utils/appError')
const bcrypt = require("bcryptjs");
const generateJWT = require("../utils/generateJWT");

const registerPatient = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, email, password, phone, gender, dataOfBirth, age, address, healthHistory } = req.body;
    const patient = await Patient.findOne({ email: email });
    if (patient) {
        const error = appError.create('User already exists', 400, httpStatusText.FAIL);
        return next(error);
    }

    // salt, which is a random string added to the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newPatient = new Patient({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        gender,
        dataOfBirth,
        age,
        address,
        healthHistory
    });
    // secure way to encode and transmit user information 
    // between (usually between the client and server)
    try {
        const token = await generateJWT({ email: newPatient.email, id: newPatient._id, role: 'patient' });
        newPatient.token = token;

        await newPatient.save();
        res.status(201).json({ status: httpStatusText.SUCCESS, data: { patient: newPatient } });
    } catch (err) {
        return next(appError.create('Failed to register the patient', 500, httpStatusText.ERROR));
    }
});

const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        const error = appError.create('Email and Password are required', 400, httpStatusText.FAIL);
        return next(error);
    }
    const patient = await Patient.findOne({ email: email });
    if (!patient) {
        const error = appError.create('Patient not found', 404, httpStatusText.FAIL);
        return next(error);
    }
    const matchedPassword = await bcrypt.compare(password, patient.password);
    if (matchedPassword) {
        const token = await generateJWT({ email: patient.email, id: patient._id, role: patient.role });
        return res.status(200).json({ status: httpStatusText.SUCCESS, data: { token } });
    } else {
        const error = appError.create('Invalid credentials', 401, httpStatusText.FAIL);
        return next(error);
    }

});

const getProfile = asyncHandler(async (req, res, next) => {
    const patient = await Patient.findById(req.currentUser.id);
    if (!patient) {
        return res.status(404).json({ status: httpStatusText.FAIL, message: "Patient Not Found" })
    }
    res.json({ status: httpStatusText.SUCCESS, data: { patient } });
});

const getAllPatients = asyncHandler(async (req, res, next) => {
    const query = req.query;
    const limit = parseInt(query.limit || '5');
    const page = parseInt(query.page || '1');

    if (limit <= 0 || limit > 100) {
        return res.status(400).json({ status: httpStatusText.FAIL, message: 'Invalid limit value' });
    }
    if (page <= 0) {
        return res.status(400).json({ status: httpStatusText.FAIL, message: 'Invalid page number' });
    }

    const skip = (page - 1) * limit;

    const projection = {
        __v: 0,
        password: 0
    };

    try {
        const patients = await Patient.find()
            .select(projection)
            .limit(limit)
            .skip(skip);

        res.json({
            status: httpStatusText.SUCCESS,
            data: {
                patients,
                total: await Patient.countDocuments(),
                pages: Math.ceil((await Patient.countDocuments()) / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ status: httpStatusText.ERROR, message: 'An error occurred while fetching patients' });
    }
});

module.exports = {
    registerPatient,
    login,
    getProfile,
    getAllPatients
}
