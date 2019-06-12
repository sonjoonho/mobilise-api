const moment = require("moment");

const AVAILABILITY_THRESHOLD = 0.5;

function volunteerIsAvailableForShift(volunteer, shift) {

  var dayOfWeek = moment(shift.date, "YYYY-MM-DD").toDate().getDay();
  var dayAvailability = volunteer.availability[(((dayOfWeek - 1) % 7) + 7) % 7];

  var startAvailability = dayAvailability[getSlotForTime(shift.start)];
  var stopAvailability  = dayAvailability[getSlotForTime(shift.stop)];
  
  return (Number(startAvailability) + Number(stopAvailability) / 2) >= AVAILABILITY_THRESHOLD;
}

function getSlotForTime(time) {
  var m = moment(time, "hh:mm:ss");
  if (m.isBefore(moment("12:00:00",  "hh:mm:ss"))) {
    return 0;
  } else if (m.isAfter(moment("16:00:00",  "hh:mm:ss"))) {
    return 2;
  }
  return 1;
}

function volunteerBookedOnShift(volunteer, shift) {
  for (var i = 0; i < shift.requirements.length; i++) {
    var requirement = shift.requirements[i];
    for (var j = 0; j < requirement.bookings.length; j++) {
      if (requirement.bookings[j].volunteerId === volunteer.userId) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  volunteerIsAvailableForShift,
  volunteerBookedOnShift
};