<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\OwnedSet;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<OwnedSet> */
class OwnedSetRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OwnedSet::class);
    }
}
