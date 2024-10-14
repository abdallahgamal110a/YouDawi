const Appointment = require('../models/appointmentModel')
const Patient = require('../models/patientModel')
const asyncHandler = require('../middlewares/asyncHandler')
const httpStatusText = require('../utils/httpStatusText')
const { validateAppointmentTime } = require('../utils/appointmentUtils');
const appError = require('../utils/appError')
const { authorizeUserAccess } = require('../utils/authUserAccess');
const userRoles = require('../utils/userRoles')

const getAllAppointments = asyncHandler(async(req, res) => {
    const query = req.query;
    const limit = query.limit || 5;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const appointments = await Appointment.find({}, { '__v': false }).limit(limit).skip(skip);
    res.json({ status: httpStatusText.SUCCESS, data: { appointments } });
})
const postAppointment = asyncHandler(async(req, res, next) => {
    const { patientId, doctorId, appointmentDate, appointmentTime } = req.body;
    const appointmentCheck = await validateAppointmentTime(appointmentTime, doctorId, patientId, appointmentDate);
    if (!appointmentCheck) {
        const err = appError.create('This time is already booked or does not align with doctor Schedule', 400, httpStatusText.FAIL);
        return next(err);
    }
    const appointment = new Appointment({ patientId, doctorId, appointmentDate, appointmentTime, status: 'Pending'});
    const newAppointment = await appointment.save();


    res.status(201).json({ status: httpStatusText.SUCCESS, data: { appointment: newAppointment } });
})

const getAppointmentById = asyncHandler(async(req, res) => {
    const appointment = await Appointment.findById(req.params.id).select('-__v');
    if (!appointment) {
        return res.status(404).json({ status: httpStatusText.FAIL, message: 'Appointment not found' });
    }
    res.json({ status: httpStatusText.SUCCESS, data: 'Appointment deleted' });
});

const updateAppointment = asyncHandler(async(req, res) => {
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-__v');
    // new: return updated document / runValidators: updated data meets schema requirements.
    if (!appointment) {
        return res.status(404).json({ status: httpStatusText.FAIL, message: 'Appointment not found' });
    }
    res.json({ status: httpStatusText.SUCCESS, data: { appointment } });
});

const deleteAppointment = asyncHandler(async(req, res) => {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) {
        return res.status(404).json({ status: httpStatusText.FAIL, message: 'Appointment not found' });
    }
    res.json({ status: httpStatusText.SUCCESS, data: null });
})

const getAppointmentsByDoctorId = asyncHandler(async(req, res) => {
    const requestedDoctorId = req.params.id;

    const { authorized, message } = authorizeUserAccess(
        [userRoles.ADMIN, userRoles.DOCTOR, userRoles.NURSE], // Nurses, Admins, and Doctors can access doctor appointments
        req.headers,
        requestedDoctorId
    );

    if (!authorized) {
        return res.status(403).json({ status: httpStatusText.FAIL, message });
    }
    const query = req.query;
    const limit = query.limit || 5;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const doctorAppointments = await Appointment
        .find({ doctorId: req.params.id, token: req.header.token }, { '__v': false })
        .limit(limit)
        .skip(skip);
    if (!doctorAppointments) {
        return res.status(404).json({ status: httpStatusText.FAIL, message: 'Doctor Appointments not found' });
    }
    res.json({ status: httpStatusText.SUCCESS, data: { doctorAppointments } });
});

const getAppointmentsByPatientId = asyncHandler(async(req, res) => {
    const requestedPatientId = req.params.id;

    const { authorized, message } = authorizeUserAccess(
        [userRoles.ADMIN, userRoles.PATIENT],
        req.headers,
        requestedPatientId
    );

    if (!authorized) {
        return res.status(403).json({ status: httpStatusText.FAIL, message });
    }
    const query = req.query;
    const limit = query.limit || 5;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const patientAppointments = await Appointment
        .find({ patientId: req.params.id }, { '__v': false })
        .limit(limit)
        .skip(skip);
    if (!patientAppointments) {
        return res.status(404).json({ status: httpStatusText.FAIL, message: 'Ptient Appointments not found' });
    }
    res.json({ status: httpStatusText.SUCCESS, data: { patientAppointments } });
});

const setPushSubscription = asyncHandler(async(req, res, next) => {
    const patientId = req.params.id;
    const { endpoint, keys } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
        return next(appError.create('Patient not found', 404, httpStatusText.FAIL));
    }

    patient.pushSubscription = { endpoint, keys };
    await patient.save();

    res.status(200).json({ status: httpStatusText.SUCCESS, message: 'Push subscription set successfully.' });
});

const getPushSubscription = asyncHandler(async(req, res, next) => {
    const patientId = req.params.id;

    const patient = await Patient.findById(patientId);
    if (!patient) {
        return next(appError.create('Patient not found', 404, httpStatusText.FAIL));
    }

    res.status(200).json({ status: httpStatusText.SUCCESS, data: { pushSubscription: patient.pushSubscription } });
});

const approveAppointment = asyncHandler(async(req, res, next) => {
  const appointmentId = req.params.id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        return next(appError.create('Appointment not found', 404, httpStatusText.FAIL));
    }

    appointment.status = 'Confirmed';
    await appointment.save();

    res.status(200).json({ status: httpStatusText.SUCCESS, message: 'Appointment confirmed.' });
});

const cancelAppointment = asyncHandler(async(req, res, next) => {
  const appointmentId = req.params.id;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        return next(appError.create('Appointment not found', 404, httpStatusText.FAIL));
    }

    appointment.status = 'Cancelled';
    await appointment.save();

    res.status(200).json({ status: httpStatusText.SUCCESS, message: 'Appointment cancelled.' });
});

module.exports = {
    getAllAppointments,
    postAppointment,
    getAppointmentById,
    updateAppointment,
    deleteAppointment,
    getAppointmentsByDoctorId,
    getAppointmentsByPatientId,
    setPushSubscription,
    getPushSubscription,
    approveAppointment,
    cancelAppointment
}
