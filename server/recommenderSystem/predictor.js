const Q = require("q");
const shiftRepository = require("../repositories").ShiftRepository;
const ShiftRequirement = require("../models").ShiftRequirement;
const volunteerRepository = require("../repositories").VolunteerRepository;
const getCumulativeAvailability = require('../utils/availability').getCumulativeAvailability;
const volunteerIsAvailableForShiftStart = require('../utils/availability').volunteerIsAvailableForShiftStart;
const getSlotForTime = require('../utils/availability').getSlotForTime;
const getDayOfWeekForDate = require('../utils/availability').getDayOfWeekForDate;
const Op = require("../models").Sequelize.Op;

var Predictor = function(shiftRepository) {

  this.shiftRepository = shiftRepository;

  this.computeExpectedShortages = async function(whereTrue) {
    var deferred = Q.defer();

    const cumulativeAvailability = await getCumulativeAvailability();

    var updatedShiftRequirements = [];

    await shiftRepository
      .getAllWithRequirements(whereTrue)
      .then(async shifts => {

        var i;
        for(i = 0; i < shifts.length; i++) {

          var shift = shifts[i];

          // Obtain the shift requirements
          var requirements = shift.requirements;

          var j;
          for(j = 0; j < requirements.length; j++) {

            var requirement = requirements[j];

            // Obtain the bookings made for specific role requirement
            var bookings = requirement.bookings;

            // Obtain the volunteer user ids from the bookings
            var volunteerIds = bookings.map(booking => booking.volunteerId);

            // Obtain all the volunteers who have made bookings
            var volunteers = await volunteerRepository.getAll({
              userId: { [Op.in]: volunteerIds }
            });

            // Find booked volunters who were available for shift
            var availableVolunteers = volunteers.filter(volunteer => volunteerIsAvailableForShiftStart(volunteer, shift));

            // Find cumulative availability for shift (start time)
            var dayOfWeek = getDayOfWeekForDate(shift.date);

            // Find slot for shift start time
            var slot = getSlotForTime(shift.start);

            // Heuristic to predict how many currently available volunteers will actually book
            var currentAvailabilityForShift = (cumulativeAvailability[dayOfWeek][slot] - availableVolunteers.length) * 0.30;

            // Add updated shift requirement to list
            await updatedShiftRequirements.push({
              shiftId: shift.id,
              roleName: requirement.role.name,
              numberRequired: requirement.numberRequired,
              expectedShortage: (requirement.numberRequired - bookings.length - currentAvailabilityForShift)
            });
          }
        }
        return updatedShiftRequirements;
      })
      .then(async updatedShiftRequirements => {

        var i;
        for(i = 0; i < updatedShiftRequirements.length; i++) {

          var shiftRequirement = updatedShiftRequirements[i];

          await ShiftRequirement.update(
            { expectedShortage: shiftRequirement.expectedShortage },
            {
              where: {
                shiftId: shiftRequirement.shiftId,
                roleName: shiftRequirement.roleName
              }
            }
          );

        }
      })
      .then(result => deferred.resolve(result))
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };
};

module.exports = new Predictor(shiftRepository);
