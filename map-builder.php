<?php
$map = array();
for($y = 0; $y < 200; $y++) {
    for($x = 0; $x < 200; $x++) {
        $map[$x][$y] = array(
            0,
            null
        );
    }
}
echo json_encode($map);
