function CreateUserLogExercises() {
    const exercises = [
        {
            description: 'd1',
            duration: 1,
            date: '2010 02 01',
        },
        {
            description: 'd1',
            duration: 2,
            date: '2010 10 16',
        },
        {
            description: 'd2',
            duration: 3,
            date: '2011 03 23',
        },
        {
            description: 'd3',
            duration: 4,
            date: '2012 05 05',
        },
        {
            description: 'd3',
            duration: 5,
            date: '2012 07 10',
        },
        {
            description: 'd3',
            duration: 6,
            date: '2012 12 30',
        },
    ];
    return exercises;
}

module.exports = { CreateUserLogExercises };