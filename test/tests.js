var request = require('supertest');
var app = require('../app');


describe('View shifts', function() {
  it('responds with json', function(done) {
    request(app)
      .get('/shifts')
      .set('Accept', 'application/json')
      .expect(200, done);
  });
})

describe('Add shifts', function() {
  it('responds with json', function(done) {
    request(app)
      .post('/shifts')
      .send(
        {
          title: 'Fundraising event',
          description: 'We gonna make some money'
        }
        )
      .set('Accept', 'application/json')
      .expect(201, done);
  });
})

describe('Register user', function() {
  it('responds with json', function(done) {
    request(app)
      .post('/users/register')
      .send(
        {
          firstName: 'James',
          lastName: 'Test',
          email: 'jamestest@testing.com',
          password: 'Testing123',
          dob: '1998-11-25'
        }
        )
      .set('Accept', 'application/json')
      .expect(201, done);
  });
})