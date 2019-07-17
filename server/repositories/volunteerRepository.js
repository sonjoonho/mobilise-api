const {Volunteer} = require("../models");
const Q = require("q");
const VolunteerRepositoryInterface = require("./interfaces/volunteerRepositoryInterface");
const { USER, SHIFTS } = require("../sequelizeUtils/include");
var VolunteerRepository = Object.create(VolunteerRepositoryInterface);

VolunteerRepository.add = function(volunteer) {
  var deferred = Q.defer();

  Volunteer.create({
    userId: volunteer.userId
  })
    .then(volunteer => deferred.resolve(volunteer))
    .catch(error => deferred.reject(error));

  return deferred.promise;
};

VolunteerRepository.getTotalHoursFromLastWeek = function() {
  var deferred = Q.defer();

  Volunteer.sum("lastWeekHours")
    .then(hours => deferred.resolve(hours))
    .catch(error => deferred.reject(error));

  return deferred.promise;
};

VolunteerRepository.getTop = function(orderBy, limit) {
  var deferred = Q.defer();

  Volunteer.findAll({
    include: [USER()],
    order: orderBy,
    limit: limit
  })
    .then(volunteers => deferred.resolve(volunteers))
    .catch(err => deferred.reject(err));

  return deferred.promise;
};

VolunteerRepository.getAll = function(whereTrue) {
  var deferred = Q.defer();

  Volunteer.findAll({
    where: whereTrue,
    include: [USER()]
  })
    .then(volunteers => deferred.resolve(volunteers))
    .catch(err => deferred.reject(err));

  return deferred.promise;
};

VolunteerRepository.getAllWithShifts = function(whereShift) {
  var deferred = Q.defer();

  Volunteer.findAll({
    include: [SHIFTS(false, whereShift)]
  })
    .then(volunteers => deferred.resolve(volunteers))
    .catch(err => deferred.reject(err));

  return deferred.promise;
};

VolunteerRepository.getById = function(id) {
  var deferred = Q.defer();

  Volunteer.findOne({
    where: { userId: id },
    include: [USER()]
  })
    .then(volunteer => deferred.resolve(volunteer))
    .catch(err => deferred.reject(err));

  return deferred.promise;
};

VolunteerRepository.update = function(volunteer, body) {
  var deferred = Q.defer();
  Volunteer.update(body, { where: { userId: volunteer.userId } })
    .then(result => deferred.resolve(result))
    .catch(error => deferred.reject(error));
  return deferred.promise;
};

VolunteerRepository.updateAvailability = function(id, availability) {
  var deferred = Q.defer();

  Volunteer.update({ availability: availability }, { where: { userId: id } })
    .then(result => deferred.resolve(result))
    .catch(error => deferred.reject(error));

  return deferred.promise;
};

VolunteerRepository.getAvailability = function(id) {
  var deferred = Q.defer();

  Volunteer.findOne({ where: { userId: id } })
    .then(volunteer => deferred.resolve(volunteer.availability))
    .catch(error => deferred.reject(error));

  return deferred.promise;
};

module.exports = VolunteerRepository;
