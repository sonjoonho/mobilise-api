var request = require("supertest");
var app = require("../../app");
var { describe, it } = require("mocha");
const Seeded = require('../../server/utils/seeded');

describe("Volunteers' Activity", function() {

  it("Does not allow unauthorised requests to get activity", function(done) {
    request(app)
      .get(`/volunteers/${Seeded.volunteers[0].UUID}/activity`)
      .set("Accept", "application/json")
      .expect(401, done);
  });

  it("Does not allow volunteers to view others' activity", function(done) {
    request(app)
      .post("/auth/login")
      .send({
        email: Seeded.volunteers[0].email,
        password: Seeded.volunteers[0].password
      })
      .set("Accept", "application/json")
      .expect(200)
      .then(response => {
        // Use bearer token to get shifts
        request(app)
          .get(`/volunteers/${Seeded.volunteers[1].UUID}/activity`)
          .set("Authorization", "Bearer " + response.body.token)
          .set("Accept", "application/json")
          .expect(401, done);
      });
  });

  it("Allows volunteers to view their own activity", function(done) {
    // Acquire bearer token
    request(app)
      .post("/auth/login")
      .send({
        email: Seeded.volunteers[0].email,
        password: Seeded.volunteers[0].password
      })
      .set("Accept", "application/json")
      .expect(200)
      .then(response => {
        // Use bearer token to get shifts
        request(app)
          .get(`/volunteers/${Seeded.volunteers[0].UUID}/activity`)
          .set("Authorization", "Bearer " + response.body.token)
          .set("Accept", "application/json")
          .expect(200, done);
      });
  });
});